import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Search, Loader2, Check, Globe, RotateCcw, SlidersHorizontal,
  Building2, ArrowUpDown, Filter, Sparkles, CheckCircle2, AlertCircle
} from "lucide-react";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import { toast } from "sonner";
import { pricingStore, usePricingStore, MASTER_PRICING_ITEMS } from "../data/pricingStore";
import { ProvinsiFilterSelect } from "./ProvinsiFilterSelect";
import { SamsatCostItem, ResolvedTariff } from "../../domain/pricing/types";

// 29 Canonical components grouped strictly into 18 Mutasi Keluar & 11 Mutasi Masuk
const MUTASI_KELUAR_ITEMS = MASTER_PRICING_ITEMS.filter((i) => i.category === "Mutasi Keluar");
const MUTASI_MASUK_ITEMS = MASTER_PRICING_ITEMS.filter((i) => i.category === "Mutasi Masuk");
const ALL_CANONICAL_ITEMS = [...MUTASI_KELUAR_ITEMS, ...MUTASI_MASUK_ITEMS];

export function HargaDasarSamsat() {
  usePricingStore();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvinsi, setSelectedProvinsi] = useState("all");
  const [onlyOverridesFilter, setOnlyOverridesFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal 1: Atur Harga Standar Nasional
  const [isStandardDialogOpen, setIsStandardDialogOpen] = useState(false);
  const [standardPricesInput, setStandardPricesInput] = useState<Record<string, number>>({});
  const [standardActiveInput, setStandardActiveInput] = useState<Record<string, boolean>>({});
  const [isSavingStandard, setIsSavingStandard] = useState(false);
  const [standardActiveTab, setStandardActiveTab] = useState<"keluar" | "masuk">("keluar");

  // Modal 2: Edit Tarif Khusus per-Samsat
  const [selectedSamsatForEdit, setSelectedSamsatForEdit] = useState<{ id: string; name: string; wilayah?: string } | null>(null);
  const [isSamsatEditDialogOpen, setIsSamsatEditDialogOpen] = useState(false);
  const [samsatTariffInputs, setSamsatTariffInputs] = useState<Record<string, number | null>>({});
  const [initialSamsatTariffSnapshot, setInitialSamsatTariffSnapshot] = useState<string>("");
  const [isSavingSamsatEdit, setIsSavingSamsatEdit] = useState(false);
  const [samsatEditActiveTab, setSamsatEditActiveTab] = useState<"keluar" | "masuk">("keluar");

  // Discard Confirmation Dialog
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  // Reset Confirmation Dialog
  const [isResetConfirmDialogOpen, setIsResetConfirmDialogOpen] = useState(false);
  const [isResettingOverrides, setIsResettingOverrides] = useState(false);

  // Master Data & Caches
  const nationalItems = useMemo(() => pricingStore.getNationalPricingItems(), [pricingStore]);
  const nationalItemsMap = useMemo(() => {
    const map = new Map<string, SamsatCostItem>();
    nationalItems.forEach((it) => map.set(it.id, it));
    return map;
  }, [nationalItems]);

  const allSamsats = useMemo(() => pricingStore.getSamsats(), [pricingStore]);

  // Province mapping for fast search & filtering
  const samsatNameToProvinsiMap = useMemo(() => {
    const map = new Map<string, string>();
    allSamsats.forEach((s) => {
      if (s.nama_provinsi) {
        map.set(s.name.toLowerCase().trim(), s.nama_provinsi);
        map.set(s.wilayah.toLowerCase().trim(), s.nama_provinsi);
        map.set(s.id.toLowerCase().trim(), s.nama_provinsi);
      }
    });
    return map;
  }, [allSamsats]);

  // Active overrides set for fast badge & filter
  const officesWithOverrides = useMemo(() => {
    return pricingStore.getOfficesWithOverrides();
  }, [pricingStore]);

  // Filtered Samsats
  const filteredSamsats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allSamsats
      .filter((s) => {
        // Only Overrides filter
        if (onlyOverridesFilter && !officesWithOverrides.has(s.id)) {
          return false;
        }

        // Province filter
        const cleanSamsat = (s.name || "").trim();
        const itemProv =
          s.nama_provinsi ||
          samsatNameToProvinsiMap.get(cleanSamsat.toLowerCase()) ||
          samsatNameToProvinsiMap.get(cleanSamsat.replace(/^samsat\s+/i, "").toLowerCase());

        if (selectedProvinsi !== "all") {
          if (selectedProvinsi === "unmapped") {
            if (itemProv && itemProv !== "-" && itemProv !== "Belum Terpetakan") return false;
          } else {
            if (!itemProv || itemProv.toLowerCase() !== selectedProvinsi.toLowerCase()) {
              return false;
            }
          }
        }

        // Search query
        if (q !== "") {
          const matchesName = cleanSamsat.toLowerCase().includes(q);
          const matchesWilayah = (s.wilayah || "").toLowerCase().includes(q);
          const matchesProv = itemProv ? itemProv.toLowerCase().includes(q) : false;
          if (!matchesName && !matchesWilayah && !matchesProv) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }));
  }, [allSamsats, searchQuery, selectedProvinsi, onlyOverridesFilter, officesWithOverrides, samsatNameToProvinsiMap]);

  // Paginated Samsats
  const paginatedSamsats = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSamsats.length / itemsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * itemsPerPage;
    return filteredSamsats.slice(start, start + itemsPerPage);
  }, [filteredSamsats, currentPage, itemsPerPage]);

  // Dirty check for Samsat Edit dialog
  const isSamsatEditDirty = useMemo(() => {
    if (!initialSamsatTariffSnapshot) return false;
    return JSON.stringify(samsatTariffInputs) !== initialSamsatTariffSnapshot;
  }, [samsatTariffInputs, initialSamsatTariffSnapshot]);

  // ─── HANDLERS: ATUR HARGA STANDAR NASIONAL ──────────────────────────────────
  const handleOpenStandardDialog = () => {
    const prices: Record<string, number> = {};
    const actives: Record<string, boolean> = {};

    ALL_CANONICAL_ITEMS.forEach((comp) => {
      const item = nationalItemsMap.get(comp.id);
      prices[comp.id] = item ? item.basePrice : 0;
      actives[comp.id] = item ? item.active !== false && item.isActive !== false : true;
    });

    setStandardPricesInput(prices);
    setStandardActiveInput(actives);
    setStandardActiveTab("keluar");
    setIsStandardDialogOpen(true);
  };

  const handleSaveStandardPrices = async () => {
    try {
      setIsSavingStandard(true);
      for (const comp of ALL_CANONICAL_ITEMS) {
        const nominal = Math.max(0, Math.round(Number(standardPricesInput[comp.id]) || 0));
        const isActive = standardActiveInput[comp.id] !== false;
        await pricingStore.updateNationalDefault(comp.id, {
          basePrice: nominal,
          active: isActive,
          isActive: isActive,
          isConfigured: true,
        });
      }
      setIsStandardDialogOpen(false);
      toast.success("Tarif standar nasional (29 komponen) berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan tarif standar nasional.");
    } finally {
      setIsSavingStandard(false);
    }
  };

  // ─── HANDLERS: EDIT TARIF PER SAMSAT ────────────────────────────────────────
  const handleOpenSamsatEdit = (samsat: { id: string; name: string; wilayah?: string }) => {
    setSelectedSamsatForEdit(samsat);

    // Resolve current tariffs for each component
    const inputs: Record<string, number | null> = {};
    ALL_CANONICAL_ITEMS.forEach((comp) => {
      const resolved = pricingStore.resolveEffectiveTariff(samsat.id, comp.id);
      // If overridden, store the override value; otherwise store null (indicating follows standard)
      if (resolved.source === "OVERRIDE" && resolved.effectivePrice !== null) {
        inputs[comp.id] = resolved.effectivePrice;
      } else {
        inputs[comp.id] = null;
      }
    });

    setSamsatTariffInputs(inputs);
    setInitialSamsatTariffSnapshot(JSON.stringify(inputs));
    setSamsatEditActiveTab("keluar");
    setIsSamsatEditDialogOpen(true);
  };

  const handleCloseSamsatEdit = () => {
    if (isSamsatEditDirty) {
      setIsDiscardDialogOpen(true);
    } else {
      setIsSamsatEditDialogOpen(false);
      setSelectedSamsatForEdit(null);
    }
  };

  const handleConfirmDiscard = () => {
    setIsDiscardDialogOpen(false);
    setIsSamsatEditDialogOpen(false);
    setSelectedSamsatForEdit(null);
  };

  const handleSaveSamsatEdit = async () => {
    if (!selectedSamsatForEdit) return;
    try {
      setIsSavingSamsatEdit(true);
      await pricingStore.saveSamsatRowOverrides(selectedSamsatForEdit.id, samsatTariffInputs);
      setIsSamsatEditDialogOpen(false);
      setSelectedSamsatForEdit(null);
      toast.success(`Tarif khusus untuk "${selectedSamsatForEdit.name}" berhasil disimpan!`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan tarif khusus Samsat.");
    } finally {
      setIsSavingSamsatEdit(false);
    }
  };

  const handleConfirmResetAllOverrides = async () => {
    if (!selectedSamsatForEdit) return;
    try {
      setIsResettingOverrides(true);
      await pricingStore.resetAllSamsatOverrides(selectedSamsatForEdit.id);

      // Reset form state to all null
      const resetInputs: Record<string, number | null> = {};
      ALL_CANONICAL_ITEMS.forEach((comp) => {
        resetInputs[comp.id] = null;
      });
      setSamsatTariffInputs(resetInputs);
      setInitialSamsatTariffSnapshot(JSON.stringify(resetInputs));

      setIsResetConfirmDialogOpen(false);
      setIsSamsatEditDialogOpen(false);
      setSelectedSamsatForEdit(null);
      toast.success(`Seluruh tarif khusus "${selectedSamsatForEdit.name}" dikembalikan ke Standar Nasional.`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengembalikan tarif ke standar nasional.");
    } finally {
      setIsResettingOverrides(false);
    }
  };

  // Helper to render cell value in table
  const renderPriceCell = (samsatId: string, comp: { id: string; name: string }) => {
    const resolved: ResolvedTariff = pricingStore.resolveEffectiveTariff(samsatId, comp.id);
    const defaultVal = resolved.nationalDefaultPrice ?? 0;

    if (resolved.status === "DISABLED_ITEM") {
      return (
        <span className="text-[11px] text-muted-foreground/60 line-through select-none" title="Komponen dinonaktifkan secara nasional">
          Nonaktif
        </span>
      );
    }

    if (resolved.status === "NOT_CONFIGURED") {
      return (
        <span className="text-xs text-amber-500 font-semibold" title="Belum dikonfigurasi">
          —
        </span>
      );
    }

    if (resolved.status === "CORRUPTED_OVERRIDE") {
      return (
        <span className="text-xs text-destructive font-bold inline-flex items-center gap-1" title="Data override tidak valid">
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      );
    }

    const price = resolved.effectivePrice ?? 0;
    const isOverride = resolved.source === "OVERRIDE";

    return (
      <div className="flex items-center justify-end gap-1">
        {isOverride && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse"
            title={`Tarif Khusus Kantor Ini (Standar Nasional: Rp ${defaultVal.toLocaleString("id-ID")})`}
          />
        )}
        <span
          className={`font-mono text-xs tabular-nums ${
            isOverride
              ? "font-bold text-primary"
              : "font-normal text-foreground/80"
          }`}
          title={isOverride ? `Tarif Khusus (Standar: Rp ${defaultVal.toLocaleString("id-ID")})` : "Mengikuti Standar Nasional"}
        >
          Rp {price.toLocaleString("id-ID")}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* ─── HEADER & STATS BAR ───────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5 bg-card border-border/80 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  Harga Dasar Samsat
                </h2>
                <p className="text-xs text-muted-foreground">
                  Kelola biaya riil seluruh kantor Samsat. Gunakan tarif acuan standar nasional atau atur tarif khusus per kantor.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Stats Badges */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/30 text-xs">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-foreground">{allSamsats.length} Samsat</span>
              <span className="text-border">|</span>
              <span className="text-muted-foreground">29 Komponen</span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {officesWithOverrides.size} Tarif Khusus
              </span>
            </div>

            {/* Primary Action: Atur Harga Standar */}
            <Button
              onClick={handleOpenStandardDialog}
              size="sm"
              className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Atur Harga Standar</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── SEARCH & FILTER TOOLBAR ──────────────────────────────────────── */}
      <Card className="p-3 bg-card border-border/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <ProvinsiFilterSelect
              value={selectedProvinsi}
              onValueChange={(val) => {
                setSelectedProvinsi(val);
                setCurrentPage(1);
              }}
            />

            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none px-2.5 py-1.5 rounded-md border border-border/70 bg-background hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={onlyOverridesFilter}
                onChange={(e) => {
                  setOnlyOverridesFilter(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
              />
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Hanya yang punya tarif khusus ({officesWithOverrides.size})
              </span>
            </label>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama Samsat atau wilayah..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-8 text-xs bg-background border-border w-full"
            />
          </div>
        </div>
      </Card>

      {/* ─── UNIFIED MATRIX TABLE ─────────────────────────────────────────── */}
      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 min-h-[420px]">
          <Table className="w-full text-xs">
            {/* Header Tier 1 & Tier 2 */}
            <TableHeader className="bg-muted/60 border-b border-border sticky top-0 z-30">
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="min-w-[220px] sticky left-0 bg-muted z-30 font-bold text-xs h-9 px-3.5 text-foreground border-r border-border/60">
                  Nama Samsat
                </TableHead>
                <TableHead
                  colSpan={18}
                  className="text-center font-bold text-xs h-9 px-3 text-primary bg-primary/5 border-r border-border/60"
                >
                  Mutasi Keluar (18 Komponen)
                </TableHead>
                <TableHead
                  colSpan={11}
                  className="text-center font-bold text-xs h-9 px-3 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-r border-border/60"
                >
                  Mutasi Masuk (11 Komponen)
                </TableHead>
                <TableHead className="text-center sticky right-0 bg-muted z-30 font-bold text-xs h-9 px-2 text-foreground w-[90px] border-l border-border/60">
                  Aksi
                </TableHead>
              </TableRow>

              <TableRow className="hover:bg-transparent text-[11px] border-b border-border">
                <TableHead className="sticky left-0 bg-muted z-30 h-8 px-3.5 border-r border-border/60 text-muted-foreground font-semibold">
                  Wilayah / Provinsi
                </TableHead>

                {/* 18 Kolom Mutasi Keluar */}
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Legalisir</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Hadir</TableHead>
                <TableHead className="min-w-[105px] h-8 px-2.5 text-right font-medium text-foreground/80">Legalisir CF</TableHead>
                <TableHead className="min-w-[85px] h-8 px-2.5 text-right font-medium text-foreground/80">CF</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Bantuan</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Hadir 2</TableHead>
                <TableHead className="min-w-[100px] h-8 px-2.5 text-right font-medium text-foreground/80">Cek Blokir</TableHead>
                <TableHead className="min-w-[125px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. Pembukuan</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. TU</TableHead>
                <TableHead className="min-w-[115px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. TU Nopil</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Loksus</TableHead>
                <TableHead className="min-w-[100px] h-8 px-2.5 text-right font-medium text-foreground/80">Cetak SKP</TableHead>
                <TableHead className="min-w-[105px] h-8 px-2.5 text-right font-medium text-foreground/80">Cetak Fiskal</TableHead>
                <TableHead className="min-w-[100px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. Arsip</TableHead>
                <TableHead className="min-w-[115px] h-8 px-2.5 text-right font-medium text-foreground/80">Cek Progresif</TableHead>
                <TableHead className="min-w-[115px] h-8 px-2.5 text-right font-medium text-foreground/80">Matiin Nopil</TableHead>
                <TableHead className="min-w-[150px] h-8 px-2.5 text-right font-medium text-foreground/80">Daftar Mutmas Normal</TableHead>
                <TableHead className="min-w-[150px] h-8 px-2.5 text-right font-medium text-foreground/80 border-r border-border/60">Daftar Mutmas Kilat</TableHead>

                {/* 11 Kolom Mutasi Masuk */}
                <TableHead className="min-w-[115px] h-8 px-2.5 text-right font-medium text-foreground/80">Legalisir Mutmas</TableHead>
                <TableHead className="min-w-[165px] h-8 px-2.5 text-right font-medium text-foreground/80">Mutmas By Pendaftaran</TableHead>
                <TableHead className="min-w-[145px] h-8 px-2.5 text-right font-medium text-foreground/80">Req Ganjil Genap</TableHead>
                <TableHead className="min-w-[95px] h-8 px-2.5 text-right font-medium text-foreground/80">Nopol Acak</TableHead>
                <TableHead className="min-w-[100px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. TU Masuk</TableHead>
                <TableHead className="min-w-[130px] h-8 px-2.5 text-right font-medium text-foreground/80">Lok. Pembukuan Masuk</TableHead>
                <TableHead className="min-w-[110px] h-8 px-2.5 text-right font-medium text-foreground/80">Daftar BPKB</TableHead>
                <TableHead className="min-w-[125px] h-8 px-2.5 text-right font-medium text-foreground/80">Penulisan BPKB</TableHead>
                <TableHead className="min-w-[105px] h-8 px-2.5 text-right font-medium text-foreground/80">Cetak Notice</TableHead>
                <TableHead className="min-w-[105px] h-8 px-2.5 text-right font-medium text-foreground/80">Cetak STNK</TableHead>
                <TableHead className="min-w-[105px] h-8 px-2.5 text-right font-medium text-foreground/80 border-r border-border/60">Cetak Plat</TableHead>

                <TableHead className="sticky right-0 bg-muted z-30 h-8 px-2 border-l border-border/60"></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* ─── PINNED TOP ROW: STANDAR NASIONAL ───────────────────────────── */}
              <TableRow className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/20 font-semibold transition-colors">
                <TableCell className="px-3.5 py-2.5 sticky left-0 bg-background/95 backdrop-blur-xs z-20 border-r border-border/60 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      ★
                    </span>
                    <div>
                      <div className="font-bold text-xs text-primary flex items-center gap-1.5">
                        STANDAR NASIONAL
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Tarif acuan seluruh Samsat
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* 18 Kolom Mutasi Keluar - Standar */}
                {MUTASI_KELUAR_ITEMS.map((comp) => {
                  const item = nationalItemsMap.get(comp.id);
                  const price = item?.basePrice ?? 0;
                  return (
                    <TableCell key={comp.id} className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-foreground font-semibold">
                      Rp {price.toLocaleString("id-ID")}
                    </TableCell>
                  );
                })}

                {/* 11 Kolom Mutasi Masuk - Standar */}
                {MUTASI_MASUK_ITEMS.map((comp) => {
                  const item = nationalItemsMap.get(comp.id);
                  const price = item?.basePrice ?? 0;
                  return (
                    <TableCell key={comp.id} className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-foreground font-semibold">
                      Rp {price.toLocaleString("id-ID")}
                    </TableCell>
                  );
                })}

                <TableCell className="px-2 py-1.5 text-center sticky right-0 bg-background/95 backdrop-blur-xs z-20 border-l border-border/60 shadow-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenStandardDialog}
                    className="h-7 text-[11px] px-2.5 font-semibold text-primary hover:text-primary hover:bg-primary/10 border-primary/40"
                  >
                    Atur
                  </Button>
                </TableCell>
              </TableRow>

              {/* ─── DATA ROWS: SAMSAT OFFICES ─────────────────────────────────── */}
              {paginatedSamsats.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={31} className="text-center py-12 align-middle">
                    <EmptyState
                      title="Tidak ada kantor Samsat"
                      description="Tidak ada kantor Samsat yang cocok dengan kata kunci atau filter saat ini."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSamsats.map((samsat) => {
                  const hasOverride = officesWithOverrides.has(samsat.id);
                  return (
                    <TableRow
                      key={samsat.id}
                      className="hover:bg-muted/40 transition-colors border-b border-border/60 last:border-0 h-10"
                    >
                      {/* Sticky Left: Samsat Name */}
                      <TableCell className="px-3.5 py-2 text-xs sticky left-0 bg-card z-10 border-r border-border/60">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground/90 truncate flex items-center gap-1.5">
                              {samsat.name}
                              {hasOverride && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium text-primary bg-primary/10 border-primary/20">
                                  Khusus
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {samsat.nama_provinsi || samsat.wilayah || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* 18 Kolom Mutasi Keluar */}
                      {MUTASI_KELUAR_ITEMS.map((comp) => (
                        <TableCell key={comp.id} className="px-2.5 py-2 text-right">
                          {renderPriceCell(samsat.id, comp)}
                        </TableCell>
                      ))}

                      {/* 11 Kolom Mutasi Masuk */}
                      {MUTASI_MASUK_ITEMS.map((comp) => (
                        <TableCell key={comp.id} className="px-2.5 py-2 text-right">
                          {renderPriceCell(samsat.id, comp)}
                        </TableCell>
                      ))}

                      {/* Sticky Right: Action */}
                      <TableCell className="px-2 py-1.5 text-center sticky right-0 bg-card z-10 border-l border-border/60">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenSamsatEdit(samsat)}
                          className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ─── PAGINATION BAR ──────────────────────────────────────────────── */}
        <div className="border-t border-border p-2 bg-muted/20">
          <TablePagination
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredSamsats.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(val) => {
              setItemsPerPage(val);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* ─── MODAL 1: ATUR HARGA STANDAR NASIONAL ───────────────────────────── */}
      <Dialog open={isStandardDialogOpen} onOpenChange={setIsStandardDialogOpen}>
        <DialogContent className="border-border sm:max-w-2xl max-h-[85vh] flex flex-col bg-card">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>Atur Harga Standar Nasional (29 Komponen)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tarif acuan ini otomatis berlaku untuk seluruh kantor Samsat yang tidak memiliki tarif khusus.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={standardActiveTab}
            onValueChange={(v) => setStandardActiveTab(v as "keluar" | "masuk")}
            className="flex-1 flex flex-col min-h-0 pt-2"
          >
            <TabsList className="grid grid-cols-2 bg-muted/50 p-1 rounded-md shrink-0 mb-3">
              <TabsTrigger value="keluar" className="text-xs font-semibold">
                Mutasi Keluar ({MUTASI_KELUAR_ITEMS.length})
              </TabsTrigger>
              <TabsTrigger value="masuk" className="text-xs font-semibold">
                Mutasi Masuk ({MUTASI_MASUK_ITEMS.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[300px]">
              <TabsContent value="keluar" className="mt-0 space-y-2">
                {MUTASI_KELUAR_ITEMS.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <span>{comp.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 text-muted-foreground">
                          {comp.code}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Status: {standardActiveInput[comp.id] !== false ? "Aktif" : "Nonaktif"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-36">
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          value={standardPricesInput[comp.id] ?? 0}
                          onChange={(e) =>
                            setStandardPricesInput({
                              ...standardPricesInput,
                              [comp.id]: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="h-8 text-xs font-mono font-bold text-right"
                        />
                      </div>
                      <Switch
                        checked={standardActiveInput[comp.id] !== false}
                        onCheckedChange={(checked) =>
                          setStandardActiveInput({
                            ...standardActiveInput,
                            [comp.id]: checked,
                          })
                        }
                        title="Aktifkan / Nonaktifkan komponen"
                      />
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="masuk" className="mt-0 space-y-2">
                {MUTASI_MASUK_ITEMS.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <span>{comp.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 text-muted-foreground">
                          {comp.code}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Status: {standardActiveInput[comp.id] !== false ? "Aktif" : "Nonaktif"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-36">
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          value={standardPricesInput[comp.id] ?? 0}
                          onChange={(e) =>
                            setStandardPricesInput({
                              ...standardPricesInput,
                              [comp.id]: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="h-8 text-xs font-mono font-bold text-right"
                        />
                      </div>
                      <Switch
                        checked={standardActiveInput[comp.id] !== false}
                        onCheckedChange={(checked) =>
                          setStandardActiveInput({
                            ...standardActiveInput,
                            [comp.id]: checked,
                          })
                        }
                        title="Aktifkan / Nonaktifkan komponen"
                      />
                    </div>
                  </div>
                ))}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="pt-3 border-t border-border/60 shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSavingStandard}
              onClick={() => setIsStandardDialogOpen(false)}
              className="text-xs h-8.5"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSavingStandard}
              onClick={handleSaveStandardPrices}
              className="text-xs h-8.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
            >
              {isSavingStandard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Simpan Perubahan Standar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: EDIT TARIF PER SAMSAT ───────────────────────────────── */}
      <Dialog open={isSamsatEditDialogOpen} onOpenChange={(open) => { if (!open) handleCloseSamsatEdit(); }}>
        <DialogContent className="border-border sm:max-w-2xl max-h-[88vh] flex flex-col bg-card">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Ubah Tarif: {selectedSamsatForEdit?.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Isi tarif khusus untuk kantor ini. Kolom yang tidak diisi otomatis mengikuti Standar Nasional.
                </DialogDescription>
              </div>

              {selectedSamsatForEdit && officesWithOverrides.has(selectedSamsatForEdit.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsResetConfirmDialogOpen(true)}
                  className="h-7 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-500/10 shrink-0 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Semua ke Standar</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs
            value={samsatEditActiveTab}
            onValueChange={(v) => setSamsatEditActiveTab(v as "keluar" | "masuk")}
            className="flex-1 flex flex-col min-h-0 pt-2"
          >
            <TabsList className="grid grid-cols-2 bg-muted/50 p-1 rounded-md shrink-0 mb-3">
              <TabsTrigger value="keluar" className="text-xs font-semibold">
                Mutasi Keluar ({MUTASI_KELUAR_ITEMS.length})
              </TabsTrigger>
              <TabsTrigger value="masuk" className="text-xs font-semibold">
                Mutasi Masuk ({MUTASI_MASUK_ITEMS.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[320px]">
              <TabsContent value="keluar" className="mt-0 space-y-2">
                {MUTASI_KELUAR_ITEMS.map((comp) => {
                  const nationalPrice = nationalItemsMap.get(comp.id)?.basePrice ?? 0;
                  const currentVal = samsatTariffInputs[comp.id];
                  const hasCustom = currentVal !== null && currentVal !== undefined;
                  return (
                    <div
                      key={comp.id}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${
                        hasCustom
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-muted/10"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <span>{comp.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 text-muted-foreground">
                            {comp.code}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Standar Nasional: <span className="font-mono">Rp {nationalPrice.toLocaleString("id-ID")}</span>
                          {hasCustom ? (
                            <span className="ml-2 font-semibold text-primary">● Tarif Khusus</span>
                          ) : (
                            <span className="ml-2 text-muted-foreground">(Mengikuti Standar)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-36">
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder={nationalPrice.toLocaleString("id-ID")}
                            value={hasCustom ? currentVal : ""}
                            onChange={(e) => {
                              const val = e.target.value.trim() === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              setSamsatTariffInputs({
                                ...samsatTariffInputs,
                                [comp.id]: val,
                              });
                            }}
                            className={`h-8 text-xs font-mono font-bold text-right ${
                              hasCustom ? "text-primary border-primary/50" : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        {hasCustom ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSamsatTariffInputs({
                                ...samsatTariffInputs,
                                [comp.id]: null,
                              });
                            }}
                            className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                            title="Kembalikan komponen ini ke Standar Nasional"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="masuk" className="mt-0 space-y-2">
                {MUTASI_MASUK_ITEMS.map((comp) => {
                  const nationalPrice = nationalItemsMap.get(comp.id)?.basePrice ?? 0;
                  const currentVal = samsatTariffInputs[comp.id];
                  const hasCustom = currentVal !== null && currentVal !== undefined;
                  return (
                    <div
                      key={comp.id}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${
                        hasCustom
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-muted/10"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <span>{comp.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 text-muted-foreground">
                            {comp.code}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Standar Nasional: <span className="font-mono">Rp {nationalPrice.toLocaleString("id-ID")}</span>
                          {hasCustom ? (
                            <span className="ml-2 font-semibold text-primary">● Tarif Khusus</span>
                          ) : (
                            <span className="ml-2 text-muted-foreground">(Mengikuti Standar)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-36">
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder={nationalPrice.toLocaleString("id-ID")}
                            value={hasCustom ? currentVal : ""}
                            onChange={(e) => {
                              const val = e.target.value.trim() === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              setSamsatTariffInputs({
                                ...samsatTariffInputs,
                                [comp.id]: val,
                              });
                            }}
                            className={`h-8 text-xs font-mono font-bold text-right ${
                              hasCustom ? "text-primary border-primary/50" : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        {hasCustom ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSamsatTariffInputs({
                                ...samsatTariffInputs,
                                [comp.id]: null,
                              });
                            }}
                            className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                            title="Kembalikan komponen ini ke Standar Nasional"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="pt-3 border-t border-border/60 shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSavingSamsatEdit}
              onClick={handleCloseSamsatEdit}
              className="text-xs h-8.5"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSavingSamsatEdit}
              onClick={handleSaveSamsatEdit}
              className="text-xs h-8.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
            >
              {isSavingSamsatEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Simpan Tarif Samsat</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ALERT DIALOG DISCARD CHANGES ──────────────────────────────────── */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Batalkan Perubahan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Ada perubahan tarif yang belum disimpan. Jika ditutup, seluruh perubahan yang Anda buat akan dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel className="text-xs h-8">Lanjut Mengedit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Buang Perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── ALERT DIALOG RESET ALL OVERRIDES ──────────────────────────────── */}
      <AlertDialog open={isResetConfirmDialogOpen} onOpenChange={setIsResetConfirmDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              <span>Kembalikan Semua ke Standar Nasional?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Seluruh tarif khusus untuk <strong>{selectedSamsatForEdit?.name}</strong> akan dihapus dan kantor ini akan kembali 100% menggunakan tarif Standar Nasional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel disabled={isResettingOverrides} className="text-xs h-8">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isResettingOverrides}
              onClick={handleConfirmResetAllOverrides}
              className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {isResettingOverrides ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              <span>Ya, Kembalikan ke Standar</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
