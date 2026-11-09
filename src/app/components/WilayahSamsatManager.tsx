import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { TablePagination } from "./ui/TablePagination";
import {
  Building2,
  MapPin,
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  ShieldCheck,
  Globe2,
  Layers,
  ArrowUpDown,
  FileText,
  Link2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { pricingStore, usePricingStore } from "../data/pricingStore";
import {
  PROVINSI_LIST,
  WILAYAH_REFERENSI,
  WILAYAH_ADMINISTRATIF_LIST,
  WilayahAdministratifItem,
  findWilayahByKode,
  getWilayahByProvinsi,
  normalizeSamsatOfficeName,
} from "../../domain/pricing/wilayahIndonesiaData";
import { SamsatMasterItem } from "../../domain/pricing/types";
import { cn } from "./ui/utils";

export function WilayahSamsatManager() {
  usePricingStore();

  const [activeTab, setActiveTab] = useState<"wilayah" | "kantor">("wilayah");

  // Wilayah Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>("all");
  const [selectedJenis, setSelectedJenis] = useState<"all" | "Kabupaten" | "Kota">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "configured" | "unconfigured">("all");

  // Wilayah Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Dialog States for Kantor Samsat CRUD
  const [isAddSamsatOpen, setIsAddSamsatOpen] = useState(false);
  const [isEditSamsatOpen, setIsEditSamsatOpen] = useState(false);
  const [isDeleteSamsatOpen, setIsDeleteSamsatOpen] = useState(false);
  const [selectedSamsat, setSelectedSamsat] = useState<SamsatMasterItem | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState<boolean>(false);
  const [discardTargetType, setDiscardTargetType] = useState<"edit" | "add" | null>(null);

  // Dialog State for Linking / Adding Samsat to Specific Wilayah
  const [isLinkWilayahOpen, setIsLinkWilayahOpen] = useState(false);
  const [targetWilayah, setTargetWilayah] = useState<any | null>(null);
  const [linkMode, setLinkMode] = useState<"create" | "existing">("create");
  const [linkExistingSamsatId, setLinkExistingSamsatId] = useState<string>("");

  // Form State for Add / Edit Samsat
  const [samsatForm, setSamsatForm] = useState({
    nama: "",
    alamat: "",
    wilayah: "",
    kode_provinsi: "31",
    kode_kabupaten_kota: "31.75",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return JSON.stringify(samsatForm) !== initialSnapshot;
  }, [samsatForm, initialSnapshot]);

  const handleCancelAdd = () => {
    if (isFormDirty) {
      setDiscardTargetType("add");
      setIsDiscardDialogOpen(true);
    } else {
      setIsAddSamsatOpen(false);
    }
  };

  const handleCancelEdit = () => {
    if (isFormDirty) {
      setDiscardTargetType("edit");
      setIsDiscardDialogOpen(true);
    } else {
      setIsEditSamsatOpen(false);
    }
  };

  const handleConfirmDiscard = () => {
    if (discardTargetType === "add") {
      setIsAddSamsatOpen(false);
    } else if (discardTargetType === "edit") {
      setIsEditSamsatOpen(false);
    }
    setIsDiscardDialogOpen(false);
    setDiscardTargetType(null);
  };

  const samsats = pricingStore.getSamsats();

  // Overview data of 514 wilayah with Samsat config status
  const wilayahOverview = useMemo(() => {
    return pricingStore.getWilayahOverview({
      provinsi: selectedProvinsi,
      jenis: selectedJenis,
      search: searchQuery,
      status: selectedStatus,
    });
  }, [selectedProvinsi, selectedJenis, searchQuery, selectedStatus, samsats]);

  // Total summary statistics
  const stats = useMemo(() => {
    const totalProv = WILAYAH_REFERENSI.totalProvinsi;
    const totalKabKota = WILAYAH_REFERENSI.totalKabupatenKota;
    const totalKab = WILAYAH_REFERENSI.totalKabupaten;
    const totalKota = WILAYAH_REFERENSI.totalKota;

    // Count configured
    const configuredCodes = new Set<string>();
    samsats.forEach((s) => {
      if (s.kode_kabupaten_kota) configuredCodes.add(s.kode_kabupaten_kota);
    });
    const totalConfigured = configuredCodes.size;
    const totalUnconfigured = totalKabKota - totalConfigured;

    return {
      totalProv,
      totalKabKota,
      totalKab,
      totalKota,
      totalConfigured,
      totalUnconfigured,
      totalSamsatOffices: samsats.length,
    };
  }, [samsats]);

  // Paginated Wilayah Slice
  const totalWilayahItems = wilayahOverview.length;
  const paginatedWilayah = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return wilayahOverview.slice(start, start + itemsPerPage);
  }, [wilayahOverview, currentPage, itemsPerPage]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedProvinsi("all");
    setSelectedJenis("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  // Kabupaten / Kota options filtered by selected province for Samsat forms
  const kabKotaOptionsForProvince = useMemo(() => {
    if (!samsatForm.kode_provinsi) return [];
    return getWilayahByProvinsi(samsatForm.kode_provinsi);
  }, [samsatForm.kode_provinsi]);

  // Handlers for Add Samsat
  const handleOpenAddSamsat = () => {
    const defaultData = {
      nama: "Samsat Jakarta Timur",
      alamat: "",
      wilayah: "Jakarta Timur",
      kode_provinsi: "31",
      kode_kabupaten_kota: "31.75",
    };
    setSamsatForm(defaultData);
    setInitialSnapshot(JSON.stringify(defaultData));
    setIsAddSamsatOpen(true);
  };

  const handleSaveAddSamsat = async () => {
    if (!samsatForm.nama.trim() || !samsatForm.alamat.trim()) {
      toast.error("Nama Samsat dan Alamat wajib diisi!");
      return;
    }
    if (!samsatForm.kode_kabupaten_kota) {
      toast.error("Wilayah kabupaten/kota administratif wajib dipilih!");
      return;
    }
    const wilayahItem = findWilayahByKode(samsatForm.kode_kabupaten_kota);
    if (!wilayahItem) {
      toast.error("Kode wilayah administratif tidak valid!");
      return;
    }
    const normalizedName = normalizeSamsatOfficeName(
      samsatForm.nama.trim(),
      wilayahItem?.jenis_wilayah,
      wilayahItem?.nama_kabupaten_kota || samsatForm.wilayah
    );
    const wilayahName =
      samsatForm.wilayah.trim() ||
      (wilayahItem ? wilayahItem.nama_kabupaten_kota.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, "") : "Nasional");

    try {
      setIsSubmitting(true);
      await pricingStore.addSamsat({
        name: normalizedName,
        alamat: samsatForm.alamat.trim(),
        wilayah: wilayahName,
        kode_kabupaten_kota: samsatForm.kode_kabupaten_kota,
        nama_provinsi: wilayahItem?.nama_provinsi,
        is_verified: true,
        status_aktif: true,
      });

      setIsAddSamsatOpen(false);
      toast.success(`Kantor Samsat "${normalizedName}" berhasil didaftarkan dan dihubungkan ke ${wilayahItem?.nama_kabupaten_kota || "wilayah"}`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan data Samsat baru");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Edit Samsat
  const handleOpenEditSamsat = (samsat: SamsatMasterItem) => {
    setSelectedSamsat(samsat);
    let provCode = "31";
    let kabCode = samsat.kode_kabupaten_kota || "31.75";
    if (samsat.kode_kabupaten_kota) {
      const parts = samsat.kode_kabupaten_kota.split(".");
      provCode = parts[0] || "31";
    }
    const initialData = {
      nama: samsat.name,
      alamat: samsat.alamat || "",
      wilayah: samsat.wilayah,
      kode_provinsi: provCode,
      kode_kabupaten_kota: kabCode,
    };
    setSamsatForm(initialData);
    setInitialSnapshot(JSON.stringify(initialData));
    setIsEditSamsatOpen(true);
  };

  const handleSaveEditSamsat = async () => {
    if (!selectedSamsat) return;
    if (!samsatForm.nama.trim() || !samsatForm.alamat.trim()) {
      toast.error("Nama Samsat dan Alamat wajib diisi!");
      return;
    }
    const wilayahItem = findWilayahByKode(samsatForm.kode_kabupaten_kota);
    const normalizedName = normalizeSamsatOfficeName(
      samsatForm.nama.trim(),
      wilayahItem?.jenis_wilayah,
      wilayahItem?.nama_kabupaten_kota || samsatForm.wilayah || selectedSamsat.wilayah
    );
    try {
      setIsSubmitting(true);
      await pricingStore.updateSamsat(selectedSamsat.id, {
        name: normalizedName,
        alamat: samsatForm.alamat.trim(),
        wilayah: samsatForm.wilayah.trim(),
        kode_kabupaten_kota: samsatForm.kode_kabupaten_kota,
        nama_provinsi: wilayahItem?.nama_provinsi,
      });
      setIsEditSamsatOpen(false);
      toast.success(`Data Samsat "${normalizedName}" berhasil diperbarui`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui data Samsat");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Delete Samsat
  const handleOpenDeleteSamsat = (samsat: SamsatMasterItem) => {
    setSelectedSamsat(samsat);
    setIsDeleteSamsatOpen(true);
  };

  const handleConfirmDeleteSamsat = async () => {
    if (!selectedSamsat) return;
    try {
      setIsSubmitting(true);
      await pricingStore.deleteSamsat(selectedSamsat.id);
      setIsDeleteSamsatOpen(false);
      toast.success(`Kantor Samsat "${selectedSamsat.name}" berhasil dihapus`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus kantor Samsat");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Linking / Adding Samsat to Specific Wilayah
  const handleOpenLinkWilayah = (wilayah: any) => {
    setTargetWilayah(wilayah);
    setLinkMode("create");
    setLinkExistingSamsatId(samsats[0]?.id || "");
    const cleanWilayahName = wilayah.nama.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, "");
    const normalizedName = normalizeSamsatOfficeName(wilayah.nama, wilayah.jenis, wilayah.nama);
    setSamsatForm({
      nama: normalizedName,
      alamat: `Jl. Pelayanan ${cleanWilayahName}`,
      wilayah: cleanWilayahName,
      kode_provinsi: wilayah.kode_provinsi,
      kode_kabupaten_kota: wilayah.kode,
    });
    setIsLinkWilayahOpen(true);
  };

  const handleSaveLinkWilayah = async () => {
    if (!targetWilayah) return;

    try {
      setIsSubmitting(true);
      if (linkMode === "create") {
        if (!samsatForm.nama.trim() || !samsatForm.alamat.trim()) {
          toast.error("Nama Samsat dan Alamat wajib diisi!");
          return;
        }
        const normalizedName = normalizeSamsatOfficeName(
          samsatForm.nama.trim(),
          targetWilayah.jenis,
          targetWilayah.nama
        );
        await pricingStore.addSamsat({
          name: normalizedName,
          alamat: samsatForm.alamat.trim(),
          wilayah: samsatForm.wilayah.trim() || targetWilayah.nama.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, ""),
          kode_kabupaten_kota: targetWilayah.kode,
          nama_provinsi: targetWilayah.provinsi,
          is_verified: true,
          status_aktif: true,
        });
        toast.success(`Kantor Samsat baru "${normalizedName}" berhasil didaftarkan untuk ${targetWilayah.nama}`);
      } else {
        if (!linkExistingSamsatId) {
          toast.error("Pilih kantor Samsat yang ingin dihubungkan!");
          return;
        }
        await pricingStore.linkSamsatToWilayah(linkExistingSamsatId, targetWilayah.kode);
        const linked = samsats.find((s) => s.id === linkExistingSamsatId);
        toast.success(`Samsat "${linked?.name || linkExistingSamsatId}" berhasil dihubungkan ke ${targetWilayah.nama}`);
      }

      setIsLinkWilayahOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses penautan Samsat ke wilayah");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-muted/40 rounded-lg w-fit border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("wilayah")}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2",
              activeTab === "wilayah"
                ? "bg-card text-foreground shadow-xs border border-border/80 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe2 className="w-3.5 h-3.5 text-primary" />
            <span>Wilayah Administratif Indonesia</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
              {stats.totalKabKota}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("kantor")}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2",
              activeTab === "kantor"
                ? "bg-card text-foreground shadow-xs border border-border/80 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span>Kantor Pelayanan Samsat</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4 ml-1">
              {stats.totalSamsatOffices}
            </Badge>
          </button>
        </div>

        {activeTab === "kantor" && (
          <Button onClick={handleOpenAddSamsat} size="sm" className="gap-1.5 text-xs shadow-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Kantor Samsat</span>
          </Button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: WILAYAH ADMINISTRATIF INDONESIA (514 KAB/KOTA)                      */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "wilayah" && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Card className="p-3 border border-border/80 bg-card">
              <span className="text-[11px] text-muted-foreground block font-medium">Total Provinsi</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-foreground">{stats.totalProv}</span>
                <span className="text-[11px] text-muted-foreground">Provinsi</span>
              </div>
            </Card>

            <Card className="p-3 border border-border/80 bg-card">
              <span className="text-[11px] text-muted-foreground block font-medium">Total Kab / Kota</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-foreground">{stats.totalKabKota}</span>
                <span className="text-[11px] text-muted-foreground">Wilayah</span>
              </div>
            </Card>

            <Card className="p-3 border border-border/80 bg-card">
              <span className="text-[11px] text-muted-foreground block font-medium">Kabupaten</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.totalKab}</span>
                <span className="text-[11px] text-muted-foreground">Kabupaten</span>
              </div>
            </Card>

            <Card className="p-3 border border-border/80 bg-card">
              <span className="text-[11px] text-muted-foreground block font-medium">Kota</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{stats.totalKota}</span>
                <span className="text-[11px] text-muted-foreground">Kota</span>
              </div>
            </Card>

            <Card className="p-3 border border-emerald-500/30 bg-emerald-500/5">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Terkonfigurasi</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.totalConfigured}</span>
                <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">Wilayah</span>
              </div>
            </Card>

            <Card className="p-3 border border-amber-500/30 bg-amber-500/5">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">Belum Dikonfigurasi</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{stats.totalUnconfigured}</span>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Wilayah</span>
              </div>
            </Card>
          </div>

          {/* Reference Notice Banner */}
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Dataset Resmi Kemendagri RI: <span className="font-normal text-muted-foreground">{WILAYAH_REFERENSI.sumber}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Arsitektur master wilayah administratif dipisahkan dari kantor Samsat. Penambahan wilayah tidak otomatis membuat kantor fiktif atau tarif biaya sembarangan.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit text-[11px] shrink-0 border-border text-muted-foreground">
              Tahun Referensi: 2025
            </Badge>
          </div>

          {/* Filter Bar */}
          <Card className="p-3.5 border border-border/80 bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari kode atau nama kabupaten/kota..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-input-background"
                />
              </div>

              {/* Filter Provinsi */}
              <div>
                <Select
                  value={selectedProvinsi}
                  onValueChange={(val) => {
                    setSelectedProvinsi(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Semua Provinsi (38)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Semua Provinsi ({PROVINSI_LIST.length})</SelectItem>
                    {PROVINSI_LIST.map((p) => (
                      <SelectItem key={p.kode_provinsi} value={p.kode_provinsi}>
                        {p.kode_provinsi} - {p.nama_provinsi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Jenis */}
              <div>
                <Select
                  value={selectedJenis}
                  onValueChange={(val: any) => {
                    setSelectedJenis(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Semua Jenis Wilayah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis Wilayah</SelectItem>
                    <SelectItem value="Kabupaten">Kabupaten (416)</SelectItem>
                    <SelectItem value="Kota">Kota (98)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Status Konfigurasi & Reset */}
              <div className="flex items-center gap-2">
                <Select
                  value={selectedStatus}
                  onValueChange={(val: any) => {
                    setSelectedStatus(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-input-background border-border flex-1">
                    <SelectValue placeholder="Status Konfigurasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="configured">Terkonfigurasi (10)</SelectItem>
                    <SelectItem value="unconfigured">Belum Dikonfigurasi (504)</SelectItem>
                  </SelectContent>
                </Select>

                {(searchQuery || selectedProvinsi !== "all" || selectedJenis !== "all" || selectedStatus !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Filter"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Wilayah Table */}
          <Card className="border border-border/80 bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold w-24 bg-card">Kode</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Kabupaten / Kota</th>
                    <th className="py-2.5 px-3 font-semibold w-28 bg-card">Jenis</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Provinsi</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Kantor Samsat Terdaftar</th>
                    <th className="py-2.5 px-3 font-semibold w-36 bg-card">Status Biaya</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-40 bg-card">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedWilayah.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Tidak ada wilayah yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedWilayah.map((item) => {
                      const hasSamsat = item.hasConfiguredSamsat;
                      return (
                        <tr key={item.kode} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-[11px] font-semibold text-foreground">
                            {item.kode}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {item.nama}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0 h-4 border",
                                item.jenis === "Kota"
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              )}
                            >
                              {item.jenis}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {item.provinsi}
                          </td>
                          <td className="py-2 px-3">
                            {item.samsatOffices && item.samsatOffices.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.samsatOffices.map((s: SamsatMasterItem) => (
                                  <span
                                    key={s.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
                                  >
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    <span>{s.name}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">
                                Belum ada kantor Samsat terdaftar
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {hasSamsat ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Terkonfigurasi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                <AlertCircle className="w-3 h-3 text-muted-foreground" />
                                Belum Dikonfigurasi
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenLinkWilayah(item)}
                              className="h-7 px-2 text-[11px] gap-1 hover:border-primary/50"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>{hasSamsat ? "Kelola Samsat" : "Hubungkan Samsat"}</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-border/80 bg-card shrink-0 mt-auto">
              <TablePagination
                currentPage={currentPage}
                totalItems={totalWilayahItems}
                itemsPerPage={itemsPerPage}
                onPageChange={(page) => setCurrentPage(page)}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: KANTOR PELAYANAN SAMSAT (10 TERDAFTAR)                              */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "kantor" && (
        <div className="space-y-4">
          <Card className="p-4 border border-border/80 bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Daftar Kantor Pelayanan Samsat Terdaftar ({samsats.length})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Setiap kantor Samsat dihubungkan secara resmi ke kode wilayah Kemendagri dan mengendalikan biaya layanan yang berlaku.
                </p>
              </div>
              <Button onClick={handleOpenAddSamsat} size="sm" className="gap-1.5 text-xs shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kantor Samsat</span>
              </Button>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px] rounded-lg border border-border/80">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold bg-card">Nama Samsat</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Alamat Kantor</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Wilayah Layanan</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Kode & Kab/Kota Kemendagri</th>
                    <th className="py-2.5 px-3 font-semibold bg-card">Provinsi</th>
                    <th className="py-2.5 px-3 font-semibold w-28 bg-card">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-24 bg-card">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {samsats.map((s) => {
                    const officialWilayah = s.kode_kabupaten_kota
                      ? findWilayahByKode(s.kode_kabupaten_kota)
                      : undefined;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {s.alamat}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {s.wilayah}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.kode_kabupaten_kota ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border">
                                {s.kode_kabupaten_kota}
                              </Badge>
                              <span className="text-foreground">{officialWilayah?.nama_kabupaten_kota || s.wilayah}</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px] italic">
                              Belum ditautkan kode Kemendagri
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {s.nama_provinsi || officialWilayah?.nama_provinsi || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Terverifikasi
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditSamsat(s)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit Samsat"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDeleteSamsat(s)}
                              className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              title="Hapus Samsat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* DIALOG: TAMBAH KANTOR SAMSAT                                              */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isAddSamsatOpen} onOpenChange={(open) => { if (!open) handleCancelAdd(); }}>
        <DialogContent className="border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Tambah Kantor Samsat Baru</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Daftarkan kantor Samsat operasional dan hubungkan ke wilayah administratif Kemendagri resmi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                1. Identifikasi Kantor Pelayanan
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Nama Kantor Samsat <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Contoh: Samsat Kota Bandung"
                  value={samsatForm.nama}
                  onChange={(e) => setSamsatForm({ ...samsatForm, nama: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Alamat Kantor <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Contoh: Jl. Soekarno Hatta No. 200"
                  value={samsatForm.alamat}
                  onChange={(e) => setSamsatForm({ ...samsatForm, alamat: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Label Wilayah Ringkas (Opsional)</Label>
                <Input
                  placeholder="Contoh: Bandung"
                  value={samsatForm.wilayah}
                  onChange={(e) => setSamsatForm({ ...samsatForm, wilayah: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
                <span className="text-[11px] text-muted-foreground">
                  Digunakan untuk label cepat pada formulir order dan invoice.
                </span>
              </div>
            </div>

            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                2. Wilayah Administratif Kemendagri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Provinsi (Kemendagri)</Label>
                  <Select
                    value={samsatForm.kode_provinsi}
                    onValueChange={(val) => {
                      const firstKab = getWilayahByProvinsi(val)[0];
                      setSamsatForm({
                        ...samsatForm,
                        kode_provinsi: val,
                        kode_kabupaten_kota: firstKab ? firstKab.kode_kabupaten_kota : "",
                        wilayah: firstKab ? firstKab.nama_kabupaten_kota.replace(/^(kabupaten|kota)\s+/i, "") : "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                      <SelectValue placeholder="Pilih Provinsi" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {PROVINSI_LIST.map((p) => (
                        <SelectItem key={p.kode_provinsi} value={p.kode_provinsi}>
                          {p.nama_provinsi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Kabupaten / Kota</Label>
                  <Select
                    value={samsatForm.kode_kabupaten_kota}
                    onValueChange={(val) => {
                      const item = findWilayahByKode(val);
                      const cleanW = item ? item.nama_kabupaten_kota.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, "") : samsatForm.wilayah;
                      const autoName = item ? normalizeSamsatOfficeName(cleanW, item.jenis_wilayah, item.nama_kabupaten_kota) : samsatForm.nama;
                      setSamsatForm({
                        ...samsatForm,
                        kode_kabupaten_kota: val,
                        wilayah: cleanW,
                        nama: autoName,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                      <SelectValue placeholder="Pilih Wilayah" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {kabKotaOptionsForProvince.map((k) => (
                        <SelectItem key={k.kode_kabupaten_kota} value={k.kode_kabupaten_kota}>
                          [{k.kode_kabupaten_kota}] {k.nama_kabupaten_kota}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={handleCancelAdd} className="h-9 text-xs px-4">
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveAddSamsat} disabled={isSubmitting} className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan & Daftarkan"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* DIALOG: EDIT KANTOR SAMSAT                                                */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isEditSamsatOpen} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
        <DialogContent className="border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Edit className="w-4 h-4 text-primary" />
              <span>Edit Data Kantor Samsat</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Perbarui rincian kantor Samsat dan tautan wilayah administratif Kemendagri.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                1. Identifikasi Kantor Pelayanan
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Nama Kantor Samsat <span className="text-destructive">*</span></Label>
                <Input
                  value={samsatForm.nama}
                  onChange={(e) => setSamsatForm({ ...samsatForm, nama: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Alamat Kantor <span className="text-destructive">*</span></Label>
                <Input
                  value={samsatForm.alamat}
                  onChange={(e) => setSamsatForm({ ...samsatForm, alamat: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Label Wilayah Ringkas</Label>
                <Input
                  value={samsatForm.wilayah}
                  onChange={(e) => setSamsatForm({ ...samsatForm, wilayah: e.target.value })}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>
            </div>

            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                2. Wilayah Administratif Kemendagri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Provinsi</Label>
                  <Select
                    value={samsatForm.kode_provinsi}
                    onValueChange={(val) => {
                      const firstKab = getWilayahByProvinsi(val)[0];
                      setSamsatForm({
                        ...samsatForm,
                        kode_provinsi: val,
                        kode_kabupaten_kota: firstKab ? firstKab.kode_kabupaten_kota : "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                      <SelectValue placeholder="Pilih Provinsi" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {PROVINSI_LIST.map((p) => (
                        <SelectItem key={p.kode_provinsi} value={p.kode_provinsi}>
                          {p.nama_provinsi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Kabupaten / Kota</Label>
                  <Select
                    value={samsatForm.kode_kabupaten_kota}
                    onValueChange={(val) => {
                      const item = findWilayahByKode(val);
                      const cleanW = item ? item.nama_kabupaten_kota.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, "") : samsatForm.wilayah;
                      setSamsatForm({
                        ...samsatForm,
                        kode_kabupaten_kota: val,
                        wilayah: cleanW,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                      <SelectValue placeholder="Pilih Wilayah" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {kabKotaOptionsForProvince.map((k) => (
                        <SelectItem key={k.kode_kabupaten_kota} value={k.kode_kabupaten_kota}>
                          [{k.kode_kabupaten_kota}] {k.nama_kabupaten_kota}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={handleCancelEdit} className="h-9 text-xs px-4">
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveEditSamsat} disabled={isSubmitting} className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Alert Dialog */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Perubahan Belum Disimpan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Anda memiliki informasi kantor Samsat yang telah diubah namun belum disimpan. Jika Anda membatalkan sekarang, semua perubahan yang Anda lakukan akan dibuang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 text-xs font-medium"
              onClick={() => setIsDiscardDialogOpen(false)}
            >
              Lanjutkan Mengedit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleConfirmDiscard}
            >
              Buang Perubahan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* DIALOG: HUBUNGKAN / TAMBAH SAMSAT DARI TABEL WILAYAH                      */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isLinkWilayahOpen} onOpenChange={setIsLinkWilayahOpen}>
        <DialogContent className="border-border sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Kantor Samsat Wilayah</DialogTitle>
            <DialogDescription>
              Tautkan kantor pelayanan Samsat untuk wilayah:
            </DialogDescription>
          </DialogHeader>

          {targetWilayah && (
            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">{targetWilayah.nama}</span>
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  {targetWilayah.kode}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{targetWilayah.provinsi}</p>
            </div>
          )}

          <div className="space-y-3 mt-2 text-xs">
            {/* Mode Selection */}
            <div className="flex rounded-md border border-border p-1 bg-muted/40 gap-1">
              <button
                type="button"
                onClick={() => setLinkMode("create")}
                className={cn(
                  "flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all",
                  linkMode === "create"
                    ? "bg-card text-foreground shadow-xs border border-border font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Daftarkan Kantor Baru
              </button>
              <button
                type="button"
                onClick={() => setLinkMode("existing")}
                className={cn(
                  "flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all",
                  linkMode === "existing"
                    ? "bg-card text-foreground shadow-xs border border-border font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tautkan Samsat Terdaftar
              </button>
            </div>

            {linkMode === "create" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nama Kantor Samsat *</Label>
                  <Input
                    placeholder="Contoh: Samsat Kab. Bogor Cibinong"
                    value={samsatForm.nama}
                    onChange={(e) => setSamsatForm({ ...samsatForm, nama: e.target.value })}
                    className="h-9 text-xs bg-input-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Alamat Kantor *</Label>
                  <Input
                    placeholder="Contoh: Jl. Tegar Beriman No. 1"
                    value={samsatForm.alamat}
                    onChange={(e) => setSamsatForm({ ...samsatForm, alamat: e.target.value })}
                    className="h-9 text-xs bg-input-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Label Wilayah</Label>
                  <Input
                    value={samsatForm.wilayah}
                    onChange={(e) => setSamsatForm({ ...samsatForm, wilayah: e.target.value })}
                    className="h-9 text-xs bg-input-background"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Pilih Kantor Samsat Terdaftar</Label>
                <Select value={linkExistingSamsatId} onValueChange={setLinkExistingSamsatId}>
                  <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Pilih Kantor Samsat" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {samsats.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.wilayah})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground block">
                  Menautkan kantor Samsat ini dengan kode wilayah resmi Kemendagri {targetWilayah?.kode}.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsLinkWilayahOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveLinkWilayah} disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : (linkMode === "create" ? "Simpan Kantor Baru" : "Hubungkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* ALERT DIALOG: HAPUS KANTOR SAMSAT                                         */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <AlertDialog open={isDeleteSamsatOpen} onOpenChange={setIsDeleteSamsatOpen}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kantor Samsat?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data Samsat "{selectedSamsat?.name}"? Wilayah administratif terkait akan kembali berstatus "Belum Dikonfigurasi".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSamsat}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitting ? "Menghapus..." : "Hapus Samsat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
