import { useState, useMemo, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Play,
  Check,
  Layers,
  MapPin,
  Send,
  Info,
  Calendar,
  DollarSign,
  Edit2,
  FileCheck2,
  FileText,
  Trash2,
  ArrowLeft,
  X,
  Phone,
  ExternalLink,
  Building2,
  Car,
  ChevronRight,
  Zap,
  Save,
  Share2,
} from "lucide-react";
import {
  MessengerTaskItem,
  MessengerComponentProgress,
  getMessengerTasksForEmployee,
  UserContext,
  AvailableSamsatComponent,
  addSamsatComponentToOrder,
  deleteSamsatComponentFromOrder,
  updateMessengerComponent,
  updateMessengerComponentPrice,
  completeSamsatProcess,
  releaseSamsatTaskAction,
  startSamsatJourney,
  arriveAtSamsat,
  updateSamsatSubprogress,
  SAMSAT_WAITING_REASONS,
  getMasterSamsatComponents,
  acceptMessengerTaskAction,
  startSamsatProcessAction,
  validateSamsatComponents,
} from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { MessengerWaitingReasonDialog } from "./MessengerWaitingReasonDialog";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerSamsatViewProps {
  currentUser: UserContext;
  initialSelectedOrderNo?: string;
  onNavigateToTab?: (tab: string, orderNo?: string) => void;
  onDetailActiveChange?: (active: boolean) => void;
}

const PRESET_DURATIONS = [
  { label: "⚡ Segera (< 30 Menit)", minutes: 15, isSegera: true },
  { label: "1 Jam", minutes: 60 },
  { label: "2 Jam", minutes: 120 },
  { label: "4 Jam", minutes: 240 },
  { label: "8 Jam", minutes: 480 },
  { label: "12 Jam", minutes: 720 },
  { label: "24 Jam (1 Hari)", minutes: 1440 },
  { label: "2 Hari", minutes: 2880 },
  { label: "3 Hari", minutes: 4320 },
];

export function MessengerSamsatView({
  currentUser,
  initialSelectedOrderNo,
  onNavigateToTab,
  onDetailActiveChange,
}: MessengerSamsatViewProps) {
  const { activeOrders, isLoading, updateOrderAsync } = useOrderStore();

  // Navigation State: null = Customer List view, orderNo = Single Customer Detail view
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(initialSelectedOrderNo || null);

  useEffect(() => {
    if (initialSelectedOrderNo) {
      setSelectedOrderNo(initialSelectedOrderNo);
    }
  }, [initialSelectedOrderNo]);

  useEffect(() => {
    onDetailActiveChange?.(selectedOrderNo !== null);
    return () => {
      onDetailActiveChange?.(false);
    };
  }, [selectedOrderNo, onDetailActiveChange]);

  // Add Component Dialog State
  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [targetOrderNo, setTargetOrderNo] = useState<string | null>(null);
  const [targetOrderWilayah, setTargetOrderWilayah] = useState<string | undefined>(undefined);
  const [selectedMasterCompId, setSelectedMasterCompId] = useState<string>("");
  const [customCompName, setCustomCompName] = useState("");
  const [addComponentTab, setAddComponentTab] = useState<"mutasi_masuk" | "mutasi_keluar" | "custom">("mutasi_masuk");

  // Edit Price Dialog State
  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false);
  const [editPriceOrderNo, setEditPriceOrderNo] = useState<string | null>(null);
  const [editPriceCompId, setEditPriceCompId] = useState<string | null>(null);
  const [editPriceCompName, setEditPriceCompName] = useState("");
  const [editPriceMasterPrice, setEditPriceMasterPrice] = useState<number>(0);
  const [editPriceActualInput, setEditPriceActualInput] = useState<string>("");
  const [editPriceNote, setEditPriceNote] = useState<string>("");

  // Waiting Reason Dialog State
  const [isWaitingDialogOpen, setIsWaitingDialogOpen] = useState(false);
  const [waitingOrderNo, setWaitingOrderNo] = useState<string | null>(null);
  const [waitingComponentId, setWaitingComponentId] = useState<string | null>(null);

  // Single Duration Dialog State (Requirement #4: Satu popup pilihan durasi dengan opsi Segera)
  const [isStartProcessOpen, setIsStartProcessOpen] = useState(false);
  const [startProcessOrderNo, setStartProcessOrderNo] = useState<string | null>(null);
  const [startProcessComp, setStartProcessComp] = useState<MessengerComponentProgress | null>(null);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number>(15);
  const [isCustomDaysActive, setIsCustomDaysActive] = useState(false);
  const [customDaysInputValue, setCustomDaysInputValue] = useState<string>("2");

  // Finish Component Confirmation Dialog State
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [finishConfirmOrderNo, setFinishConfirmOrderNo] = useState<string | null>(null);
  const [finishConfirmComp, setFinishConfirmComp] = useState<MessengerComponentProgress | null>(null);

  // Simpan Progres Samsat & Multi-Messenger Handoff State (Requirement #5.C & #7)
  const [isSaveProgressOpen, setIsSaveProgressOpen] = useState(false);
  const [saveProgressReleaseToPool, setSaveProgressReleaseToPool] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Selesai Samsat Dialog State (Right of First Refusal: Bawa ke kantor vs Lempar ke kolam)
  const [isFinishSamsatOpen, setIsFinishSamsatOpen] = useState(false);
  const [finishSamsatOrderNo, setFinishSamsatOrderNo] = useState<string | null>(null);
  const [finishSamsatCustomerName, setFinishSamsatCustomerName] = useState("");
  const [isCompletingSamsat, setIsCompletingSamsat] = useState(false);

  // Filter tasks to Samsat tasks assigned to current messenger
  const samsatTasks = useMemo(() => {
    const all = getMessengerTasksForEmployee(activeOrders, currentUser);
    return all.filter((t) => t.keteranganTugas === "Proses Samsat");
  }, [activeOrders, currentUser]);

  // Master components list for the current target order
  const availableMasterComps = useMemo(() => {
    return getMasterSamsatComponents(targetOrderWilayah);
  }, [targetOrderWilayah]);

  // Customer List (search bar removed per requirement #2)
  const filteredSamsatTasks = samsatTasks;

  // Selected Task for Detail view
  const currentSelectedTask = useMemo(() => {
    if (!selectedOrderNo) return null;
    return samsatTasks.find((t) => t.orderNo === selectedOrderNo) || null;
  }, [samsatTasks, selectedOrderNo]);

  // Dokumen Fisik yang Perlu Diambil / Dibawa untuk Proses Samsat (Requirement #1)
  const physicalDocsList = useMemo(() => {
    if (!currentSelectedTask) return [];
    const clientDocs = currentSelectedTask.rawOrder?.clientDocuments;
    if (clientDocs && Object.keys(clientDocs).length > 0) {
      return Object.entries(clientDocs).map(([key, doc]) => ({
        key,
        name: doc.name || (key.toUpperCase() === "STNK" ? "STNK Asli" : key.toUpperCase() === "BPKB" ? "BPKB Asli" : key.toUpperCase() === "KTP" ? "KTP Pemilik Asli" : key.toUpperCase() === "SKKP" ? "SKKP (Surat Ketetapan Pajak)" : key),
        status: doc.status || "Sudah Tersedia",
        isMandatory: doc.isOptional !== true,
      }));
    }
    // Fallback standard physical documents needed for Samsat
    return [
      { key: "stnk", name: "STNK Asli", status: "Sudah Tersedia", isMandatory: true },
      { key: "bpkb", name: "BPKB Asli", status: "Sudah Tersedia", isMandatory: true },
      { key: "ktp", name: "KTP Pemilik Asli", status: "Sudah Tersedia", isMandatory: true },
      { key: "skkp", name: "SKKP (Surat Ketetapan Pajak)", status: "Sudah Tersedia", isMandatory: false },
    ];
  }, [currentSelectedTask]);

  // Validation & Component Progress computed unconditionally at top-level
  const samsatValidation = useMemo(() => {
    if (!currentSelectedTask?.rawOrder) {
      return {
        allowed: false,
        error: "Data order tidak tersedia",
        totalComponents: 0,
        completedComponents: 0,
        incompleteComponents: [],
      };
    }
    return validateSamsatComponents(currentSelectedTask.rawOrder);
  }, [currentSelectedTask?.rawOrder]);

  const comps: MessengerComponentProgress[] = useMemo(() => {
    if (!currentSelectedTask) return [];
    const map = new Map<string, MessengerComponentProgress>();

    // 1. From samsatProcesses
    if (currentSelectedTask.rawOrder?.samsatProcesses) {
      for (const p of currentSelectedTask.rawOrder.samsatProcesses) {
        if (!p || !p.name) continue;
        const id = String(p.id || p.name).trim();
        map.set(id, {
          componentId: id,
          name: p.name,
          category: p.category,
          nominal: p.basePrice || 0,
          masterPrice: p.basePrice || 0,
          actualOrderPrice: p.actualCost || p.basePrice || 0,
          status:
            p.status === "Selesai" || (p.status as string) === "COMPLETED"
              ? "COMPLETED"
              : p.status === "Sedang Diproses" || (p.status as string) === "IN_PROGRESS" || (p.status as string) === "Dalam Proses"
              ? "IN_PROGRESS"
              : (p.status as string) === "Menunggu" || (p.status as string) === "WAITING"
              ? "WAITING"
              : "NOT_STARTED",
        });
      }
    }

    // 2. Overlay live progress from messengerComponentProgress
    if (currentSelectedTask.componentProgress && currentSelectedTask.componentProgress.length > 0) {
      for (const cp of currentSelectedTask.componentProgress) {
        if (!cp || !cp.name) continue;
        const compKey = String(cp.componentId).trim();
        const existing = map.get(compKey) || {};
        map.set(compKey, {
          ...existing,
          ...cp,
        });
      }
    }

    return Array.from(map.values());
  }, [currentSelectedTask?.componentProgress, currentSelectedTask?.rawOrder?.samsatProcesses, currentSelectedTask]);

  // Open single duration dialog on "Mulai Proses"
  const handleOpenStartProcess = (orderNo: string, comp: MessengerComponentProgress) => {
    setStartProcessOrderNo(orderNo);
    setStartProcessComp(comp);
    setSelectedDurationMinutes(comp.estimatedDurationMinutes || 15);
    setIsCustomDaysActive(!!comp.isCustomDuration);
    setCustomDaysInputValue(comp.customDurationDays ? String(comp.customDurationDays) : "2");
    setIsStartProcessOpen(true);
  };

  // Confirm duration and start process
  const handleConfirmStartProcess = () => {
    if (!startProcessOrderNo || !startProcessComp) return;

    let finalMinutes = selectedDurationMinutes;
    let isCustom = false;
    let customDays: number | undefined = undefined;

    if (isCustomDaysActive) {
      const days = parseInt(customDaysInputValue.replace(/[^0-9]/g, ""), 10);
      if (isNaN(days) || days <= 0 || days > 365) {
        toast.error("Durasi kustom harus berupa angka antara 1 sampai 365 hari!");
        return;
      }
      finalMinutes = days * 1440;
      isCustom = true;
      customDays = days;
    }

    const res = updateMessengerComponent(
      startProcessOrderNo,
      startProcessComp.componentId,
      {
        status: "IN_PROGRESS",
        estimatedDurationMinutes: finalMinutes,
        isCustomDuration: isCustom,
        customDurationDays: customDays,
        startedAt: new Date().toISOString(),
      },
      currentUser
    );

    if (res.success) {
      updateSamsatSubprogress(startProcessOrderNo, startProcessComp.name, currentUser);
      const durText =
        finalMinutes === 15
          ? "Segera (< 30 Menit)"
          : finalMinutes >= 1440
          ? `${Math.floor(finalMinutes / 1440)} Hari`
          : `${Math.floor(finalMinutes / 60)} Jam`;
      toast.success(`Proses "${startProcessComp.name}" dimulai (Estimasi: ${durText})!`);
      setIsStartProcessOpen(false);
      setStartProcessOrderNo(null);
      setStartProcessComp(null);
    } else {
      toast.error(res.error || "Gagal memulai proses komponen");
    }
  };

  // Open finish component confirm dialog
  const handleOpenFinishConfirm = (orderNo: string, comp: MessengerComponentProgress) => {
    setFinishConfirmOrderNo(orderNo);
    setFinishConfirmComp(comp);
    setIsFinishConfirmOpen(true);
  };

  // Confirm finish component
  const handleConfirmFinishProcess = () => {
    if (!finishConfirmOrderNo || !finishConfirmComp) return;

    const res = updateMessengerComponent(
      finishConfirmOrderNo,
      finishConfirmComp.componentId,
      {
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      },
      currentUser
    );

    if (res.success) {
      toast.success(`Proses komponen "${finishConfirmComp.name}" selesai!`);
      setIsFinishConfirmOpen(false);
      setFinishConfirmOrderNo(null);
      setFinishConfirmComp(null);
    } else {
      toast.error(res.error || "Gagal menyelesaikan komponen");
    }
  };

  // Waiting reason submit
  const handleWaitingReasonSubmit = (reason: string) => {
    if (!waitingOrderNo || !waitingComponentId) return;

    const res = updateMessengerComponent(
      waitingOrderNo,
      waitingComponentId,
      {
        status: "WAITING",
        waitingReason: reason,
      },
      currentUser
    );

    if (res.success) {
      toast.info(`Komponen diubah ke status Menunggu: ${reason}`);
      setIsWaitingDialogOpen(false);
      setWaitingOrderNo(null);
      setWaitingComponentId(null);
    } else {
      toast.error(res.error || "Gagal memperbarui status komponen");
    }
  };

  // Open Edit Price dialog
  const handleOpenEditPrice = (orderNo: string, comp: MessengerComponentProgress) => {
    setEditPriceOrderNo(orderNo);
    setEditPriceCompId(comp.componentId);
    setEditPriceCompName(comp.name);
    setEditPriceMasterPrice(comp.masterPrice || comp.nominal || 0);
    setEditPriceActualInput(
      comp.actualOrderPrice !== undefined
        ? comp.actualOrderPrice.toLocaleString("id-ID")
        : (comp.masterPrice || comp.nominal || 0).toLocaleString("id-ID")
    );
    setEditPriceNote(comp.note || "");
    setIsEditPriceOpen(true);
  };

  // Save Edit Price
  const handleSaveEditPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPriceOrderNo || !editPriceCompId) return;

    const cleanNumber = Number(editPriceActualInput.replace(/[^0-9]/g, ""));
    if (isNaN(cleanNumber) || cleanNumber < 0) {
      toast.error("Nominal harga aktual tidak valid!");
      return;
    }

    const res = updateMessengerComponentPrice(
      editPriceOrderNo,
      editPriceCompId,
      cleanNumber,
      currentUser,
      editPriceNote.trim() || undefined
    );

    if (res.success) {
      toast.success(`Harga aktual "${editPriceCompName}" berhasil diperbarui ke Rp ${cleanNumber.toLocaleString("id-ID")}!`);
      setIsEditPriceOpen(false);
      setEditPriceOrderNo(null);
      setEditPriceCompId(null);
    } else {
      toast.error(res.error || "Gagal memperbarui harga aktual");
    }
  };

  // Open Add Component dialog
  const handleOpenAddComponent = (orderNo: string, wilayah?: string) => {
    setTargetOrderNo(orderNo);
    setTargetOrderWilayah(wilayah);
    setSelectedMasterCompId("");
    setCustomCompName("");
    setAddComponentTab("mutasi_masuk");
    setIsAddComponentOpen(true);
  };

  // Add Component from Catalog or Custom
  const handleSaveAddComponent = () => {
    if (!targetOrderNo) return;

    if (addComponentTab === "custom") {
      if (!customCompName.trim()) {
        toast.error("Nama komponen kustom wajib diisi!");
        return;
      }
      const res = addSamsatComponentToOrder(
        targetOrderNo,
        {
          name: customCompName.trim(),
          category: "Tambahan Lapangan",
          nominal: 0,
          isCustom: true,
          addedManually: true,
        },
        currentUser
      );
      if (res.success) {
        toast.success(`Komponen "${customCompName}" berhasil ditambahkan!`);
        setIsAddComponentOpen(false);
      } else {
        toast.error(res.error || "Gagal menambahkan komponen");
      }
      return;
    }

    if (!selectedMasterCompId) {
      toast.error("Pilih salah satu komponen dari katalog!");
      return;
    }

    const masterItem = availableMasterComps.find((m) => m.id === selectedMasterCompId);
    if (!masterItem) {
      toast.error("Komponen tidak ditemukan di katalog master!");
      return;
    }

    const masterPrice = masterItem.basePrice || masterItem.defaultNominal || 0;
    const res = addSamsatComponentToOrder(
      targetOrderNo,
      {
        name: masterItem.name,
        category: masterItem.category,
        nominal: masterPrice,
        addedManually: true,
      },
      currentUser
    );

    if (res.success) {
      toast.success(`Komponen "${masterItem.name}" berhasil ditambahkan ke order!`);
      setIsAddComponentOpen(false);
    } else {
      toast.error(res.error || "Gagal menambahkan komponen");
    }
  };

  // Delete Component
  const handleDeleteComponent = (orderNo: string, compId: string, compName: string) => {
    if (!confirm(`Hapus komponen "${compName}" dari order ini?`)) return;
    const res = deleteSamsatComponentFromOrder(orderNo, compId, currentUser);
    if (res.success) {
      toast.success(`Komponen "${compName}" berhasil dihapus.`);
    } else {
      toast.error(res.error || "Gagal menghapus komponen");
    }
  };

  // Journey handlers
  const handleStartJourney = (orderNo: string) => {
    const res = startSamsatJourney(orderNo, currentUser);
    if (res.success) {
      toast.success(`Perjalanan ke Samsat dimulai untuk order ${orderNo}!`);
    } else {
      toast.error(res.error || "Gagal memulai perjalanan ke Samsat");
    }
  };

  // Start Samsat Process (Scope 1)
  const handleStartSamsatProcess = async (orderNo: string) => {
    const res = await startSamsatProcessAction(orderNo, currentUser);
    if (res.success) {
      toast.success("Proses Samsat dimulai! Seluruh komponen loket kini siap dikelola.");
    } else {
      toast.error(res.error || "Gagal memulai proses Samsat");
    }
  };

  const handleArriveAtSamsat = (orderNo: string) => {
    const res = arriveAtSamsat(orderNo, currentUser);
    if (res.success) {
      toast.success(`Tiba di Samsat! Order ${orderNo} siap diproses di loket.`);
    } else {
      toast.error(res.error || "Gagal memperbarui status tiba di Samsat");
    }
  };

  // Simpan Progres Samsat handlers (Requirement #5.C & #7)
  const handleOpenSaveProgress = () => {
    setSaveProgressReleaseToPool(false);
    setIsSaveProgressOpen(true);
  };

  const handleConfirmSaveProgress = async () => {
    if (!currentSelectedTask) return;
    setIsSavingProgress(true);
    try {
      if (saveProgressReleaseToPool) {
        const res = releaseSamsatTaskAction(
          currentSelectedTask.orderNo,
          currentUser
        );
        if (res.success) {
          toast.success(
            `Progres Samsat ${currentSelectedTask.orderNo} berhasil disimpan dan diserahkan ke Daftar Tugas!`
          );
          setIsSaveProgressOpen(false);
          setSelectedOrderNo(null);
          if (onNavigateToTab) {
            onNavigateToTab("daftar-tugas");
          }
        } else {
          toast.error(res.error || "Gagal menyerahkan tugas");
        }
      } else {
        // Persist checkpoint without operational note input
        const nowIso = new Date().toISOString();
        const timelineEvent = {
          id: `tl-save-${Date.now()}`,
          timestamp: nowIso,
          title: "Progres Samsat Disimpan",
          note: `Kurir ${currentUser.userName} menyimpan checkpoint progres Samsat.`,
          author: currentUser.userName,
          type: "PROGRESS_UPDATE" as const,
        };

        const existingTimeline = currentSelectedTask.rawOrder?.messengerTimeline || [];
        await updateOrderAsync(currentSelectedTask.orderNo, {
          messengerTimeline: [timelineEvent, ...existingTimeline],
        });

        toast.success(
          `Progres pengurusan Samsat untuk ${currentSelectedTask.customer} berhasil disimpan!`
        );
        setIsSaveProgressOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan progres ke server");
    } finally {
      setIsSavingProgress(false);
    }
  };

  // Finish Samsat with Right of First Refusal
  const handleOpenFinishSamsat = (t: MessengerTaskItem) => {
    setFinishSamsatOrderNo(t.orderNo);
    setFinishSamsatCustomerName(t.customer);
    setIsFinishSamsatOpen(true);
  };

  const handleConfirmFinishSamsat = async (bringToOfficeMyself: boolean) => {
    if (!finishSamsatOrderNo) return;
    setIsCompletingSamsat(true);

    try {
      // 1. Mark Samsat completed
      const completeRes = completeSamsatProcess(finishSamsatOrderNo, currentUser);
      if (!completeRes.success) {
        toast.error(completeRes.error || "Gagal menyelesaikan proses Samsat");
        return;
      }

      if (bringToOfficeMyself) {
        // 2. Messenger chooses to bring documents back to office themselves
        const acceptRes = await acceptMessengerTaskAction(
          finishSamsatOrderNo,
          "Jemput Hasil Samsat",
          currentUser
        );
        if (acceptRes.success) {
          toast.success(
            `Proses Samsat ${finishSamsatOrderNo} selesai! Tugas membawa berkas ke kantor masuk ke Antar/Jemput.`
          );
          setIsFinishSamsatOpen(false);
          setSelectedOrderNo(null);
          if (onNavigateToTab) {
            onNavigateToTab("antar-jemput", finishSamsatOrderNo);
          }
        } else {
          toast.info("Proses Samsat selesai. Tugas antar berkas tersedia di Antar/Jemput.");
          setIsFinishSamsatOpen(false);
          setSelectedOrderNo(null);
        }
      } else {
        // 3. Left in pool for any other courier to pick up
        toast.success(
          `Proses Samsat ${finishSamsatOrderNo} selesai! Penjemputan berkas hasil Samsat tersedia di Daftar Tugas.`
        );
        setIsFinishSamsatOpen(false);
        setSelectedOrderNo(null);
      }
    } finally {
      setIsCompletingSamsat(false);
    }
  };

  const formatDurationDisplay = (
    minutes?: number,
    isCustom?: boolean,
    customDays?: number
  ) => {
    if (isCustom && customDays) return `${customDays} Hari`;
    if (!minutes) return "-";
    if (minutes === 15) return "⚡ Segera (< 30 mnt)";
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)} Hari`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)} Jam`;
    return `${minutes} Menit`;
  };

  // ----------------------------------------------------------------------
  // VIEW 1: DAFTAR CUSTOMER PROSES SAMSAT (Halaman Awal)
  // ----------------------------------------------------------------------
  if (!selectedOrderNo) {
    return (
      <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
        {/* Banner */}
        <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Proses Pengurusan Samsat
            </h2>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {isLoading && samsatTasks.length === 0 ? (
              <span>Memuat data pengurusan Samsat...</span>
            ) : samsatTasks.length > 0 ? (
              <span>
                Pilih salah satu customer di bawah untuk mengelola komponen dan progres di loket Samsat.
              </span>
            ) : (
              <span>
                Belum ada permohonan Samsat aktif yang ditugaskan kepada Anda. Cek menu Daftar Tugas untuk mengambil tugas Samsat.
              </span>
            )}
          </p>
        </div>

        {/* Customer Cards List */}
        {filteredSamsatTasks.length === 0 ? (
          <Card className="p-8 text-center border-dashed rounded-2xl bg-card/60">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
            <h3 className="font-semibold text-base text-foreground">
              Tidak ada customer proses Samsat
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
              Saat ini Anda belum menangani pengurusan Samsat untuk customer mana pun.
            </p>
            {onNavigateToTab && (
              <Button
                onClick={() => onNavigateToTab("daftar-tugas")}
                className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px]"
              >
                Cari Tugas Samsat di Daftar Tugas
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredSamsatTasks.map((t) => {
              const compList: MessengerComponentProgress[] =
                t.componentProgress && t.componentProgress.length > 0
                  ? t.componentProgress
                  : (t.rawOrder?.samsatProcesses || []).map((p) => ({
                      componentId: p.id,
                      name: p.name,
                      category: p.category,
                      nominal: p.basePrice || 0,
                      masterPrice: p.basePrice || 0,
                      actualOrderPrice: p.actualCost || p.basePrice || 0,
                      status:
                        p.status === "Selesai"
                          ? "COMPLETED"
                          : p.status === "Sedang Diproses"
                          ? "IN_PROGRESS"
                          : ((p.status as string) === "Menunggu"
                          ? "WAITING"
                          : "NOT_STARTED"),
                    }));

              const validList = compList.filter((c) => {
                if (
                  c.name === "Komponen Samsat" &&
                  (c.masterPrice || 0) === 0 &&
                  (c.actualOrderPrice || 0) === 0 &&
                  (c.nominal || 0) === 0
                ) {
                  return false;
                }
                const isMut =
                  c.category === "Mutasi Masuk" ||
                  c.category === "Mutasi Keluar" ||
                  c.category?.toLowerCase().includes("masuk") ||
                  c.category?.toLowerCase().includes("keluar");
                if (isMut && !c.isCustom && !c.addedManually) {
                  const eff = Math.max(c.masterPrice || 0, c.actualOrderPrice || 0, c.nominal || 0);
                  if (eff <= 0) return false;
                }
                return true;
              });

              const cCount = validList.filter((c) => c.status === "COMPLETED").length;
              const tCount = validList.length;
              const pct = tCount > 0 ? Math.round((cCount / tCount) * 100) : 0;
              const allDone = tCount > 0 && cCount === tCount;

              const samsatSt = t.rawOrder?.samsatStatus || "Menuju Samsat";

              return (
                <Card
                  key={t.orderNo}
                  className="p-4 rounded-2xl border border-border/80 bg-card hover:border-purple-400/60 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs sm:text-sm text-foreground">
                          {t.orderNo}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs"
                        >
                          {samsatSt}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-base sm:text-lg text-foreground mt-1 truncate">
                        {t.customer}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.jenisTugas || t.rawOrder?.layanan || "Layanan Samsat"} • {t.lokasi}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="font-mono text-xs font-bold bg-muted">
                        {t.nopol}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t.rawOrder?.jenisKendaraan || "Kendaraan"}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progres Komponen di Loket</span>
                      <span className="font-bold text-foreground">
                        {cCount} dari {tCount} Selesai ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300 rounded-full",
                          allDone ? "bg-emerald-600" : "bg-purple-600"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Button Footer: Touch target >= 48px, Card non-clickable, explicit Kelola button */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1 text-xs sm:text-sm truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{t.lokasi}</span>
                    </span>
                    <Button
                      onClick={() => setSelectedOrderNo(t.orderNo)}
                      className="min-h-[48px] px-4 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 text-xs sm:text-sm"
                    >
                      <span>Kelola Proses Samsat</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // VIEW 2: DETAIL DAN FORM PROSES SAMSAT CUSTOMER TERPILIH
  // ----------------------------------------------------------------------
  const task = currentSelectedTask;
  if (!task) {
    return (
      <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
        <Button
          variant="ghost"
          onClick={() => setSelectedOrderNo(null)}
          className="flex items-center gap-2 text-primary font-bold hover:bg-primary/10 pl-1 rounded-xl -ml-1 text-sm sm:text-base min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          Kembali ke Daftar Pelanggan
        </Button>
        <Card className="p-8 text-center rounded-2xl bg-card border">
          <p className="text-muted-foreground">Pelanggan tidak ditemukan atau tugas telah selesai.</p>
        </Card>
      </div>
    );
  }

  // Authoritative component progress computation (Scope 2: No fragile fallback by array length)
  const isProcessStarted = Boolean(
    task.rawOrder?.samsatStatus === "Sedang Proses Samsat" ||
    task.rawOrder?.samsatStatus === "Menuju Samsat" ||
    task.rawOrder?.samsatStatus === "Di Lokasi Samsat" ||
    task.rawOrder?.samsatJourneyStartedAt ||
    task.rawOrder?.samsatStartedAt ||
    (task.rawOrder?.samsatStatus &&
      task.rawOrder?.samsatStatus !== "Terjadwal Samsat" &&
      task.rawOrder?.samsatStatus !== "Belum Dimulai")
  );

  const canCompleteSamsat = samsatValidation.allowed;
  const completionValidationMessage = samsatValidation.error;

  const validComps = comps.filter((c) => {
    if (
      c.name === "Komponen Samsat" &&
      (c.masterPrice || 0) === 0 &&
      (c.actualOrderPrice || 0) === 0 &&
      (c.nominal || 0) === 0
    ) {
      return false;
    }
    const isMut =
      c.category === "Mutasi Masuk" ||
      c.category === "Mutasi Keluar" ||
      c.category?.toLowerCase().includes("masuk") ||
      c.category?.toLowerCase().includes("keluar");
    if (isMut && !c.isCustom && !c.addedManually) {
      const eff = Math.max(c.masterPrice || 0, c.actualOrderPrice || 0, c.nominal || 0);
      if (eff <= 0) return false;
    }
    return true;
  });

  const completedCount = validComps.filter((c) => c.status === "COMPLETED").length;
  const totalCount = validComps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  const mutasiMasukComps = validComps.filter(
    (c) =>
      !c.isCustom &&
      (c.category?.toLowerCase().includes("masuk") || c.category === "Mutasi Masuk")
  );
  const mutasiKeluarComps = validComps.filter(
    (c) =>
      !c.isCustom &&
      (c.category?.toLowerCase().includes("keluar") || c.category === "Mutasi Keluar")
  );
  const otherMasterComps = validComps.filter(
    (c) =>
      !c.isCustom &&
      !mutasiMasukComps.includes(c) &&
      !mutasiKeluarComps.includes(c)
  );
  const customComps = validComps.filter((c) => c.isCustom);

  const renderComponentRow = (comp: MessengerComponentProgress) => {
    const isDone = comp.status === "COMPLETED";
    const isInProg = comp.status === "IN_PROGRESS";
    const isWait = comp.status === "WAITING";

    const master = comp.masterPrice ?? comp.nominal ?? 0;
    const actual = comp.actualOrderPrice ?? master;
    const diff = actual - master;

    return (
      <div
        key={comp.componentId}
        className={cn(
          "p-3.5 rounded-xl border transition-all space-y-2 text-left",
          isDone && "bg-emerald-50/20 border-emerald-300 dark:border-emerald-800",
          isInProg && "bg-purple-50/20 border-purple-300 dark:border-purple-800 shadow-2xs",
          isWait && "bg-amber-50/20 border-amber-300 dark:border-amber-800",
          !isDone && !isInProg && !isWait && "bg-background border-border/70"
        )}
      >
        {/* Component Header & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground">{comp.name}</span>
              {comp.category && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  {comp.category}
                </Badge>
              )}
              {comp.isCustom && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                  Kustom
                </Badge>
              )}
            </div>

            {/* Price display with SSoT */}
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground">
                Dasar: <strong>Rp {master.toLocaleString("id-ID")}</strong>
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">
                Aktual: <strong className="text-primary font-bold">Rp {actual.toLocaleString("id-ID")}</strong>
              </span>
              {diff !== 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    diff > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  ({diff > 0 ? `+Rp ${diff.toLocaleString("id-ID")}` : `-Rp ${Math.abs(diff).toLocaleString("id-ID")}`})
                </span>
              )}
            </div>
          </div>

          {/* Edit price & delete buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenEditPrice(task.orderNo, comp)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
              title="Sesuaikan Harga Aktual Lapangan"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Ubah Biaya
            </Button>
            {comp.addedManually && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteComponent(task.orderNo, comp.componentId, comp.name)}
                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                title="Hapus Komponen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Note if any */}
        {comp.note && (
          <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-lg">
            Catatan: {comp.note}
          </p>
        )}

        {/* Waiting Reason alert */}
        {isWait && comp.waitingReason && (
          <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300 text-xs text-amber-900 dark:text-amber-200">
            <strong>Menunggu:</strong> {comp.waitingReason}
            <button
              onClick={() => {
                setWaitingOrderNo(task.orderNo);
                setWaitingComponentId(comp.componentId);
                setIsWaitingDialogOpen(true);
              }}
              className="text-xs underline font-semibold text-amber-900 dark:text-amber-200 ml-2"
            >
              Ubah
            </button>
          </div>
        )}

        {/* Clean Duration Badge (Requirement #4: NO duplicate select dropdown) */}
        {comp.estimatedDurationMinutes && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>
              Estimasi:{" "}
              <strong className="text-foreground">
                {formatDurationDisplay(comp.estimatedDurationMinutes, comp.isCustomDuration, comp.customDurationDays)}
              </strong>
            </span>
          </div>
        )}

        {/* Single Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div>
            {comp.status === "NOT_STARTED" && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Belum Dimulai
              </Badge>
            )}
            {isInProg && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                Sedang Diproses
              </Badge>
            )}
            {isWait && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                Tertunda
              </Badge>
            )}
            {isDone && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                ✓ Selesai
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isProcessStarted ? (
              <>
                {comp.status !== "IN_PROGRESS" && !isDone && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenStartProcess(task.orderNo, comp)}
                    className="min-h-[44px] text-xs font-semibold px-4 bg-primary text-primary-foreground rounded-xl shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Mulai Proses
                  </Button>
                )}

                {isInProg && !isDone && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenFinishConfirm(task.orderNo, comp)}
                    className="min-h-[44px] text-xs font-semibold px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Selesai
                  </Button>
                )}

                {isDone && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 py-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Selesai di Loket
                  </span>
                )}
              </>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground border-dashed py-1 px-2.5">
                Menunggu Mulai Samsat
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-36 sm:pb-40 text-left">
      {/* Top Back Button to Customer List */}
      <Button
        variant="ghost"
        onClick={() => setSelectedOrderNo(null)}
        className="flex items-center gap-2 text-primary font-bold hover:bg-primary/10 pl-1 rounded-xl -ml-1 text-sm sm:text-base min-h-[44px]"
      >
        <ArrowLeft className="w-5 h-5" />
        Kembali ke Daftar Pelanggan
      </Button>

      {/* Customer Info Card */}
      <Card className="p-4 sm:p-5 border rounded-2xl bg-card space-y-3 shadow-xs">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-foreground">{task.orderNo}</span>
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs"
              >
                {task.rawOrder?.samsatStatus || "Menuju Samsat"}
              </Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground mt-1">{task.customer}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {task.jenisTugas || task.rawOrder?.layanan || "Layanan Samsat"} • {task.lokasi}
            </p>
          </div>

          <div className="text-right shrink-0">
            <Badge variant="secondary" className="font-mono text-xs sm:text-sm font-bold bg-muted">
              {task.nopol}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {task.rawOrder?.jenisKendaraan || "Kendaraan"}
            </p>
          </div>
        </div>

        {/* Contact & Map */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{task.lokasi}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {task.phone && (
              <a
                href={`tel:${task.phone}`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Hubungi</span>
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.lokasi || "Samsat")}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-semibold text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Peta</span>
            </a>
          </div>
        </div>

        {/* Samsat Process Status & Start Button (Scope 1) */}
        <div className="pt-3 border-t border-border/60">
          {!isProcessStarted ? (
            <Button
              size="default"
              onClick={() => handleStartSamsatProcess(task.orderNo)}
              className="w-full h-12 min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Mulai Proses Samsat</span>
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Status Pengerjaan:</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold py-1 px-2.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{task.rawOrder?.samsatStatus || "Sedang Proses Samsat"}</span>
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Progress Card */}
      <Card className="p-4 rounded-2xl bg-card border border-border/80 space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="font-semibold text-foreground">Progres Komponen Loket Samsat</span>
          <span className="font-bold text-primary">
            {completedCount} dari {totalCount} Selesai ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isAllCompleted ? "bg-emerald-600" : "bg-purple-600"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Components Sections */}
      <div className="space-y-4">
        {/* Mutasi Keluar */}
        {mutasiKeluarComps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              Tahap Mutasi Keluar ({mutasiKeluarComps.length})
            </h4>
            <div className="space-y-2">{mutasiKeluarComps.map(renderComponentRow)}</div>
          </div>
        )}

        {/* Mutasi Masuk */}
        {mutasiMasukComps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              Tahap Mutasi Masuk ({mutasiMasukComps.length})
            </h4>
            <div className="space-y-2">{mutasiMasukComps.map(renderComponentRow)}</div>
          </div>
        )}

        {/* Other Master Components */}
        {otherMasterComps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Komponen Pokok Samsat ({otherMasterComps.length})
            </h4>
            <div className="space-y-2">{otherMasterComps.map(renderComponentRow)}</div>
          </div>
        )}

        {/* Custom Components */}
        {customComps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              Komponen Tambahan ({customComps.length})
            </h4>
            <div className="space-y-2">{customComps.map(renderComponentRow)}</div>
          </div>
        )}

        {/* Scope 1: Button Tambah Komponen (Hanya tampil setelah proses dimulai) */}
        {isProcessStarted && (
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenAddComponent(task.orderNo, task.rawOrder?.wilayahSamsatAsal)}
              className="w-full h-11 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border-dashed border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Komponen Baru
            </Button>
          </div>
        )}

        {/* Incomplete Components Notice if process started but not finished */}
        {isProcessStarted && !canCompleteSamsat && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{completionValidationMessage || "Seluruh komponen loket wajib diselesaikan (COMPLETED) sebelum menyelesaikan proses Samsat."}</span>
          </div>
        )}
      </div>

      {/* Scope 5: Fixed Bottom Action Bar (Hanya tampil setelah proses dimulai) */}
      {isProcessStarted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <Button
              size="default"
              variant="outline"
              onClick={handleOpenSaveProgress}
              className="h-12 min-h-[48px] flex-1 rounded-xl text-sm font-semibold border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20 shadow-2xs"
            >
              <Save className="w-4 h-4 mr-2" />
              Simpan Progres
            </Button>

            <Button
              size="default"
              disabled={!canCompleteSamsat || isCompletingSamsat}
              onClick={() => handleOpenFinishSamsat(task)}
              className={cn(
                "h-12 min-h-[48px] flex-1 rounded-xl text-sm font-bold shadow-md transition-all",
                canCompleteSamsat
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              )}
              title={!canCompleteSamsat ? completionValidationMessage : undefined}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Proses Selesai
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 1: SINGLE DURATION POPUP (Requirement #4: Opsi Segera + Presets) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isStartProcessOpen} onOpenChange={setIsStartProcessOpen}>
        <DialogContent className="max-w-md w-full p-4 sm:p-5 gap-3.5 text-left rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Pilih Estimasi Durasi Pengerjaan
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Tentukan perkiraan waktu pengerjaan untuk komponen{" "}
              <strong>{startProcessComp?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = !isCustomDaysActive && selectedDurationMinutes === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => {
                      setIsCustomDaysActive(false);
                      setSelectedDurationMinutes(preset.minutes);
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs sm:text-sm font-semibold text-center transition-all min-h-[44px] flex items-center justify-center",
                      isSelected
                        ? preset.isSegera
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border/80"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}

              {/* Custom Days Option */}
              <button
                type="button"
                onClick={() => setIsCustomDaysActive(true)}
                className={cn(
                  "p-2.5 rounded-xl border text-xs sm:text-sm font-semibold text-center transition-all min-h-[44px] flex items-center justify-center",
                  isCustomDaysActive
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border/80"
                )}
              >
                + Kustom (Hari)
              </button>
            </div>

            {/* Custom Days Input if active */}
            {isCustomDaysActive && (
              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Jumlah Hari Pengerjaan di Loket:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={customDaysInputValue}
                    onChange={(e) => setCustomDaysInputValue(e.target.value)}
                    className="h-10 text-sm rounded-xl bg-background border-border font-bold w-28"
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground font-semibold">Hari</span>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 justify-end pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStartProcessOpen(false)}
                className="min-h-[40px] text-xs sm:text-sm rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleConfirmStartProcess}
                className="bg-primary text-primary-foreground font-bold min-h-[40px] text-xs sm:text-sm px-5 rounded-xl shadow-xs"
              >
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                Mulai Proses
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 2: FINISH SAMSAT & RIGHT OF FIRST REFUSAL */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isFinishSamsatOpen} onOpenChange={setIsFinishSamsatOpen}>
        <DialogContent className="max-w-md w-full p-4 sm:p-5 gap-3.5 text-left rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Selesaikan Pengurusan Samsat
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Seluruh berkas untuk <strong>{finishSamsatCustomerName}</strong> ({finishSamsatOrderNo}) telah selesai di loket Samsat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-2">
              <p className="text-xs font-bold text-foreground">
                Bagaimana penjemputan berkas dari Samsat ke kantor?
              </p>
              <p className="text-xs text-muted-foreground">
                Pilih apakah Anda ingin langsung membawa dokumen ini kembali ke kantor SUN89, atau membiarkannya di kolam tugas agar dapat diambil oleh kurir lain.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={isCompletingSamsat}
                onClick={() => handleConfirmFinishSamsat(false)}
                className="h-12 text-xs font-semibold rounded-xl border-border hover:bg-muted"
              >
                Biarkan di Kolam Tugas (Kurir Lain)
              </Button>

              <Button
                type="button"
                disabled={isCompletingSamsat}
                onClick={() => handleConfirmFinishSamsat(true)}
                className="h-12 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Saya Bawa ke Kantor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 3: FINISH COMPONENT CONFIRMATION */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isFinishConfirmOpen} onOpenChange={setIsFinishConfirmOpen}>
        <DialogContent className="max-w-sm w-full p-4 sm:p-5 gap-3 text-left rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Konfirmasi Selesai Komponen
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin komponen <strong>{finishConfirmComp?.name}</strong> telah selesai diproses di loket Samsat?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFinishConfirmOpen(false)}
              className="min-h-[40px] text-xs sm:text-sm rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFinishProcess}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold min-h-[40px] text-xs sm:text-sm px-4 rounded-xl shadow-xs"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Ya, Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 4: EDIT PRICE ACTUAL */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <DialogContent className="max-w-sm w-full p-4 sm:p-5 gap-3 text-left rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Sesuaikan Harga Aktual Lapangan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Komponen: <strong>{editPriceCompName}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditPrice} className="space-y-3 pt-1">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Harga Dasar (SSoT):{" "}
                <strong className="text-foreground">
                  Rp {editPriceMasterPrice.toLocaleString("id-ID")}
                </strong>
              </span>
              <Label className="text-xs font-semibold">Harga Aktual Lapangan (Rp)</Label>
              <Input
                type="text"
                value={editPriceActualInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setEditPriceActualInput(val ? Number(val).toLocaleString("id-ID") : "");
                }}
                className="text-base font-bold text-foreground mt-1 rounded-xl h-11"
                placeholder="0"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Alasan Penyesuaian Harga</Label>
              <Input
                type="text"
                value={editPriceNote}
                onChange={(e) => setEditPriceNote(e.target.value)}
                placeholder="Contoh: Denda PKB keterlambatan, tarif Samsat baru"
                className="mt-1 rounded-xl text-xs sm:text-sm h-11"
              />
            </div>

            <DialogFooter className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPriceOpen(false)}
                className="rounded-xl min-h-[40px] text-xs sm:text-sm"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground font-semibold rounded-xl min-h-[40px] text-xs sm:text-sm"
              >
                Simpan Harga
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 5: ADD COMPONENT FROM CATALOG OR CUSTOM */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isAddComponentOpen} onOpenChange={setIsAddComponentOpen}>
        <DialogContent className="max-w-md w-full p-4 sm:p-5 gap-3.5 text-left rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Tambah Komponen Samsat
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pilih komponen dari katalog master atau masukkan komponen kustom.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={addComponentTab}
            onValueChange={(v) => setAddComponentTab(v as any)}
            className="w-full flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid grid-cols-3 mb-2 rounded-xl">
              <TabsTrigger value="mutasi_masuk" className="text-xs rounded-lg">
                Mutasi Masuk
              </TabsTrigger>
              <TabsTrigger value="mutasi_keluar" className="text-xs rounded-lg">
                Mutasi Keluar
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs rounded-lg">
                + Kustom
              </TabsTrigger>
            </TabsList>

            <div className="overflow-y-auto flex-1 max-h-[300px] space-y-2 pr-1">
              {addComponentTab !== "custom" ? (
                <div className="space-y-1.5">
                  {availableMasterComps
                    .filter((m) =>
                      addComponentTab === "mutasi_masuk"
                        ? m.category === "Mutasi Masuk" || m.category.toLowerCase().includes("masuk")
                        : m.category === "Mutasi Keluar" || m.category.toLowerCase().includes("keluar")
                    )
                    .map((item) => {
                      const itemPrice = item.basePrice || item.defaultNominal || 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedMasterCompId(item.id)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left cursor-pointer transition-all",
                            selectedMasterCompId === item.id
                              ? "bg-primary/10 border-primary font-semibold text-foreground shadow-2xs"
                              : "bg-card hover:bg-muted/50 border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-semibold text-foreground">{item.name}</span>
                            <span className="text-primary font-bold">
                              Rp {itemPrice.toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-xs font-semibold">Nama Komponen Kustom</Label>
                    <Input
                      value={customCompName}
                      onChange={(e) => setCustomCompName(e.target.value)}
                      placeholder="Contoh: Cek Fisik Bantuan, Surat Keterangan Fiskal"
                      className="mt-1 rounded-xl text-xs sm:text-sm h-11"
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 justify-end pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddComponentOpen(false)}
                className="rounded-xl min-h-[40px] text-xs sm:text-sm"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSaveAddComponent}
                className="bg-primary text-primary-foreground font-semibold rounded-xl min-h-[40px] text-xs sm:text-sm"
              >
                Tambahkan
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOG 6: SIMPAN PROGRES SAMSAT & MULTI-MESSENGER HANDOFF (Requirement #5.C & #7) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isSaveProgressOpen} onOpenChange={setIsSaveProgressOpen}>
        <DialogContent className="max-w-md w-full p-4 sm:p-5 gap-3.5 text-left rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-600" />
              Simpan Progres Samsat
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Simpan pembaruan status dan harga aktual komponen untuk{" "}
              <strong>{currentSelectedTask?.customer}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1">
            <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">
                Ringkasan Pengerjaan:
              </p>
              <p className="text-xs text-muted-foreground">
                • {completedCount} dari {totalCount} komponen selesai ({progressPercent}%)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Tindakan Penugasan
              </Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSaveProgressReleaseToPool(false)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    !saveProgressReleaseToPool
                      ? "border-purple-600 bg-purple-500/10"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-xs font-bold text-foreground">
                    Tetap Pegang Tugas Ini
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Progres tersimpan dan Anda tetap menjadi penanggung jawab tugas ini.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveProgressReleaseToPool(true)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    saveProgressReleaseToPool
                      ? "border-amber-600 bg-amber-500/10"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-amber-600" />
                    Serahkan ke Tim (Kembalikan ke Daftar Tugas)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Komponen yang selesai tetap tersimpan. Sisa komponen dapat dilanjutkan oleh rekan kurir lain.
                  </p>
                </button>
              </div>
            </div>



            <DialogFooter className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSaveProgressOpen(false)}
                className="rounded-xl min-h-[40px] text-xs sm:text-sm"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isSavingProgress}
                onClick={handleConfirmSaveProgress}
                className={cn(
                  "rounded-xl min-h-[40px] text-xs sm:text-sm font-semibold text-white",
                  saveProgressReleaseToPool
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-purple-600 hover:bg-purple-700"
                )}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {isSavingProgress
                  ? "Menyimpan..."
                  : saveProgressReleaseToPool
                  ? "Simpan & Kembalikan ke Pool"
                  : "Simpan Progres"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waiting Reason Dialog */}
      <MessengerWaitingReasonDialog
        open={isWaitingDialogOpen}
        onOpenChange={setIsWaitingDialogOpen}
        title="Pilih Kendala Komponen Samsat"
        description="Pilih alasan status menunggu untuk komponen ini:"
        reasons={SAMSAT_WAITING_REASONS}
        onSubmit={handleWaitingReasonSubmit}
      />
    </div>
  );
}
