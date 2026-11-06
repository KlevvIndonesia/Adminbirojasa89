/**
 * Estimation Master Configuration & Management Hub
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides centralized administration for estimation cost components,
 * structured formula parameters, component activation toggles,
 * and live calculation preview across all 10 canonical templates.
 */

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Calculator,
  Settings2,
  RotateCcw,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Shield,
  Info,
  Save,
  Sliders,
  DollarSign,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../ui/utils";
import {
  EstimationTemplateConfig,
  EstimationComponentRule,
  EstimationInput,
  EstimationServiceType,
  ComponentCategory,
  CalculationMethod,
  ProgramSamsat,
} from "../../../domain/estimation/types";
import { estimationStore, useEstimationStore } from "../../data/estimationStore";
import { calculateEstimation } from "../../../domain/estimation/estimationEngine";
import { CalculationExplanationModal } from "./CalculationExplanationModal";
import { EstimatorR4Tahunan } from "./EstimatorR4Tahunan";
import { EstimatorR2Tahunan } from "./EstimatorR2Tahunan";
import { EstimatorExtended } from "./EstimatorExtended";

export function resolveTemplateIdByService(service: string, vehicle: "Mobil" | "Motor"): string {
  const isMobil = vehicle === "Mobil";
  if (service.includes("1 Tahun") || service === "Tahunan") {
    return isMobil ? "template-pajak-tahunan-r4" : "template-pajak-tahunan-r2";
  }
  if (service.includes("5 Tahun")) {
    return isMobil ? "template-pajak-5-tahun-r4" : "template-pajak-5-tahun-r2";
  }
  if (service.includes("Balik") || service.includes("BBN")) {
    return isMobil ? "template-bbn-r4" : "template-bbn-r2";
  }
  if (service.includes("Antar Samsat")) {
    return isMobil ? "template-mutasi-as-r4" : "template-mutasi-as-r2";
  }
  if (service.includes("Luar Daerah")) {
    return isMobil ? "template-mutasi-ld-r4" : "template-mutasi-ld-r2";
  }
  return isMobil ? "template-pajak-tahunan-r4" : "template-pajak-tahunan-r2";
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  PKB: "Pokok Pajak (PKB)",
  DENDA_PKB: "Denda PKB",
  SWDKLLJ: "SWDKLLJ Pokok",
  DENDA_SWDKLLJ: "Denda SWDKLLJ",
  ADMIN: "Administrasi Resmi",
  JASA: "Jasa Layanan",
  INSIDENTAL: "Biaya Insidental",
  ACC_ID: "ACC ID & Proses",
  PROSES: "Biaya Proses",
  BBN: "Bea Balik Nama (BBN)",
};

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  PKB: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  DENDA_PKB: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  SWDKLLJ: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  DENDA_SWDKLLJ: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  ADMIN: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  JASA: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  INSIDENTAL: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  ACC_ID: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  PROSES: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  BBN: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
};

const CALC_METHOD_LABELS: Record<CalculationMethod, string> = {
  fixed_amount: "Biaya Tetap",
  manual_amount: "Nilai Manual",
  percentage_of_base: "Persentase Dasar",
  pkb_penalty_by_month: "Denda Bulanan",
  annual_rate_by_arrears: "Tarif Tahunan",
  regional_allocation: "Alokasi Wilayah",
  formula_rule: "Formula Workbook",
};

export function EstimationMasterManager() {
  const store = useEstimationStore();

  // Navigation states
  const [selectedService, setSelectedService] = useState<EstimationServiceType>("Tahunan");
  const [selectedVehicle, setSelectedVehicle] = useState<"Mobil" | "Motor">("Mobil");

  // Active template
  const activeTemplateId = resolveTemplateIdByService(selectedService, selectedVehicle);
  const activeTemplate = store.getTemplate(activeTemplateId);

  // Parameter Form State
  const [paramKoefisienDenda, setParamKoefisienDenda] = useState<string>(
    activeTemplate?.koefisienDenda !== undefined ? (activeTemplate.koefisienDenda * 100).toString() : "48"
  );
  const [paramPembagiBulan, setParamPembagiBulan] = useState<string>(
    activeTemplate?.pembagiBulan?.toString() || "12"
  );
  const [paramPembulatan, setParamPembulatan] = useState<string>(
    activeTemplate?.kelipatanPembulatan?.toString() || "1000"
  );
  const [paramSwdklljPokok, setParamSwdklljPokok] = useState<string>(
    activeTemplate?.swdklljPokok?.toString() || (selectedVehicle === "Mobil" ? "143000" : "35000")
  );
  const [paramDendaSwdklljPokok, setParamDendaSwdklljPokok] = useState<string>(
    activeTemplate?.dendaSwdklljPokok?.toString() || (selectedVehicle === "Mobil" ? "100000" : "32000")
  );
  const [paramBiayaJasa, setParamBiayaJasa] = useState<string>(
    activeTemplate?.biayaJasa?.toString() || "250000"
  );
  const [paramBiayaCetakSkp, setParamBiayaCetakSkp] = useState<string>(
    activeTemplate?.biayaCetakSkp?.toString() || (selectedVehicle === "Mobil" ? "100000" : "50000")
  );
  const [paramAdminStnk, setParamAdminStnk] = useState<string>(
    activeTemplate?.adminStnk?.toString() || (selectedVehicle === "Mobil" ? "200000" : "100000")
  );
  const [paramAdminTnkb, setParamAdminTnkb] = useState<string>(
    activeTemplate?.adminTnkb?.toString() || (selectedVehicle === "Mobil" ? "100000" : "60000")
  );

  // Sync parameter form state when active template changes
  React.useEffect(() => {
    if (activeTemplate) {
      setParamKoefisienDenda((activeTemplate.koefisienDenda * 100).toString());
      setParamPembagiBulan(activeTemplate.pembagiBulan?.toString() || "12");
      setParamPembulatan(activeTemplate.kelipatanPembulatan?.toString() || "1000");
      setParamSwdklljPokok(activeTemplate.swdklljPokok?.toString() || (selectedVehicle === "Mobil" ? "143000" : "35000"));
      setParamDendaSwdklljPokok(activeTemplate.dendaSwdklljPokok?.toString() || (selectedVehicle === "Mobil" ? "100000" : "32000"));
      setParamBiayaJasa(activeTemplate.biayaJasa?.toString() || "250000");
      setParamBiayaCetakSkp(activeTemplate.biayaCetakSkp?.toString() || (selectedVehicle === "Mobil" ? "100000" : "50000"));
      setParamAdminStnk(activeTemplate.adminStnk?.toString() || (selectedVehicle === "Mobil" ? "200000" : "100000"));
      setParamAdminTnkb(activeTemplate.adminTnkb?.toString() || (selectedVehicle === "Mobil" ? "100000" : "60000"));
    }
  }, [activeTemplateId, activeTemplate?.updatedAt]);

  // Modals & Dialogs
  const [isResetDialogOpen, setIsResetDialogOpen] = useState<boolean>(false);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState<boolean>(false);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState<boolean>(false);
  const [isEditComponentModalOpen, setIsEditComponentModalOpen] = useState<boolean>(false);
  const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState<boolean>(false);
  const [selectedComponent, setSelectedComponent] = useState<EstimationComponentRule | null>(null);

  // Edit Component Form State
  const [editCompData, setEditCompData] = useState<{
    name: string;
    category: ComponentCategory;
    calculationMethod: CalculationMethod;
    defaultValue: string;
    minAmount: string;
    maxAmount: string;
    description: string;
    isActive: boolean;
    includesInTotal: boolean;
  }>({
    name: "",
    category: "ADMIN",
    calculationMethod: "fixed_amount",
    defaultValue: "0",
    minAmount: "",
    maxAmount: "",
    description: "",
    isActive: true,
    includesInTotal: true,
  });

  // Add Component Form State
  const [newCompData, setNewCompData] = useState<{
    code: string;
    name: string;
    category: ComponentCategory;
    calculationMethod: CalculationMethod;
    defaultValue: string;
    description: string;
    includesInTotal: boolean;
  }>({
    code: "ADM-NEW",
    name: "",
    category: "ADMIN",
    calculationMethod: "fixed_amount",
    defaultValue: "0",
    description: "",
    includesInTotal: true,
  });

  // Quick In-Line Simulation Input State
  const defaultPkb = selectedVehicle === "Mobil" ? 3964000 : 51000;
  const [simPkb, setSimPkb] = useState<string>(defaultPkb.toString());
  const [simDueDate, setSimDueDate] = useState<string>("2023-12-23");
  const [simProgram, setSimProgram] = useState<ProgramSamsat>("NORMAL");

  // Keep simulation PKB in sync when vehicle toggles
  React.useEffect(() => {
    setSimPkb((selectedVehicle === "Mobil" ? 3964000 : 51000).toString());
  }, [selectedVehicle]);

  // Live Quick Preview Calculation
  const quickPreviewResult = useMemo(() => {
    const input: EstimationInput = {
      pkbDasar: parseFloat(simPkb) || 0,
      tanggalJatuhTempo: simDueDate || "2023-12-23",
      tanggalEstimasi: new Date().toISOString().split("T")[0],
      programSamsat: simProgram,
      kondisiBerkas: "LENGKAP",
      wilayahAccId: "DKI Jakarta",
      freeBbn: true,
      wilayahAsal: "DKI Jakarta",
      wilayahTujuan: "DKI Jakarta",
    };
    return calculateEstimation(input, activeTemplate);
  }, [simPkb, simDueDate, simProgram, activeTemplate]);

  // Handler: Save Formula Parameters
  const handleSaveParameters = () => {
    const koefVal = parseFloat(paramKoefisienDenda);
    if (isNaN(koefVal) || koefVal < 0 || koefVal > 500) {
      toast.error("Koefisien denda tidak valid. Masukkan persentase antara 0% dan 500%.");
      return;
    }

    const pembagiVal = parseInt(paramPembagiBulan, 10);
    if (isNaN(pembagiVal) || pembagiVal <= 0 || pembagiVal > 60) {
      toast.error("Pembagi bulan denda harus berupa bilangan positif antara 1 dan 60.");
      return;
    }

    const pembulatanVal = parseInt(paramPembulatan, 10);
    if (isNaN(pembulatanVal) || pembulatanVal < 1) {
      toast.error("Kelipatan pembulatan harus berupa angka positif.");
      return;
    }

    const updates = {
      koefisienDenda: koefVal / 100, // convert percentage e.g. 48 -> 0.48
      pembagiBulan: pembagiVal,
      kelipatanPembulatan: pembulatanVal,
      swdklljPokok: parseFloat(paramSwdklljPokok) || 0,
      dendaSwdklljPokok: parseFloat(paramDendaSwdklljPokok) || 0,
      biayaJasa: parseFloat(paramBiayaJasa) || 0,
      biayaCetakSkp: parseFloat(paramBiayaCetakSkp) || 0,
      adminStnk: parseFloat(paramAdminStnk) || 0,
      adminTnkb: parseFloat(paramAdminTnkb) || 0,
    };

    const success = store.updateTemplateParams(activeTemplate.id, updates);
    if (success) {
      toast.success(`Parameter rumus ${activeTemplate.name} berhasil disimpan dan disinkronkan ke server.`);
    } else {
      toast.error("Gagal menyimpan parameter rumus.");
    }
  };

  // Handler: Reset to Official Workbook Defaults
  const handleConfirmReset = () => {
    store.resetToDefault(activeTemplate.id);
    setIsResetDialogOpen(false);
    toast.success(`Template ${activeTemplate.name} telah dikembalikan ke Standar Resmi Default Workbook.`);
  };

  // Handler: Toggle Component Active Status
  const handleToggleActive = (componentId: string) => {
    store.toggleComponent(activeTemplate.id, componentId);
    toast.info("Status komponen berhasil diperbarui.");
  };

  // Handler: Toggle Masuk Total
  const handleToggleIncludeInTotal = (componentId: string) => {
    store.toggleIncludeInTotal(activeTemplate.id, componentId);
    toast.info("Pengaturan Masuk Total komponen berhasil diperbarui.");
  };

  // Handler: Open Edit Component Modal
  const handleOpenEditComponent = (comp: EstimationComponentRule) => {
    setSelectedComponent(comp);
    setEditCompData({
      name: comp.name,
      category: comp.category,
      calculationMethod: comp.calculationMethod || (comp.valueType === "manual" ? "manual_amount" : "fixed_amount"),
      defaultValue: comp.defaultValue.toString(),
      minAmount: comp.minAmount !== undefined ? comp.minAmount.toString() : "",
      maxAmount: comp.maxAmount !== undefined ? comp.maxAmount.toString() : "",
      description: comp.description || "",
      isActive: comp.isActive,
      includesInTotal: comp.includesInTotal,
    });
    setIsEditComponentModalOpen(true);
  };

  // Handler: Save Edited Component
  const handleSaveEditedComponent = () => {
    if (!selectedComponent) return;
    const defVal = parseFloat(editCompData.defaultValue) || 0;
    const minVal = editCompData.minAmount ? parseFloat(editCompData.minAmount) : undefined;
    const maxVal = editCompData.maxAmount ? parseFloat(editCompData.maxAmount) : undefined;

    store.updateComponentRule(activeTemplate.id, selectedComponent.id, {
      name: editCompData.name.trim() || selectedComponent.name,
      category: editCompData.category,
      calculationMethod: editCompData.calculationMethod,
      defaultValue: defVal,
      minAmount: minVal,
      maxAmount: maxVal,
      description: editCompData.description.trim(),
      isActive: editCompData.isActive,
      includesInTotal: editCompData.includesInTotal,
    });

    setIsEditComponentModalOpen(false);
    toast.success(`Komponen '${selectedComponent.name}' berhasil diperbarui.`);
  };

  // Handler: Add New Custom Component
  const handleAddNewComponent = () => {
    if (!newCompData.name.trim()) {
      toast.error("Nama komponen wajib diisi.");
      return;
    }

    const defVal = parseFloat(newCompData.defaultValue) || 0;
    const added = store.addManualComponent(activeTemplate.id, {
      code: newCompData.code.trim().toUpperCase() || "CST-01",
      name: newCompData.name.trim(),
      category: newCompData.category,
      calculationMethod: newCompData.calculationMethod,
      defaultValue: defVal,
      description: newCompData.description.trim(),
      isActive: true,
      includesInTotal: newCompData.includesInTotal,
      valueType: "manual",
    });

    if (added) {
      toast.success(`Komponen baru '${added.name}' berhasil ditambahkan ke ${activeTemplate.name}.`);
      setIsAddComponentModalOpen(false);
      setNewCompData({
        code: "ADM-NEW",
        name: "",
        category: "ADMIN",
        calculationMethod: "fixed_amount",
        defaultValue: "0",
        description: "",
        includesInTotal: true,
      });
    }
  };

  // Handler: Delete Manual Component
  const handleDeleteComponent = (componentId: string, componentName: string) => {
    const success = store.removeManualComponent(activeTemplate.id, componentId);
    if (success) {
      toast.success(`Komponen '${componentName}' berhasil dihapus.`);
    } else {
      toast.error("Komponen formula inti dilindungi dan tidak dapat dihapus.");
    }
  };

  // Metric aggregates
  const totalComponents = activeTemplate.components.length;
  const activeComponentsCount = activeTemplate.components.filter((c) => c.isActive).length;
  const includesInTotalCount = activeTemplate.components.filter((c) => c.isActive && c.includesInTotal).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar with Service & Vehicle Selectors */}
      <Card className="border-border/80 shadow-xs bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Pusat Konfigurasi Komponen & Rumus Estimasi
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Kelola parameter rumus, status komponen, dan metode perhitungan estimasi biaya layanan Samsat.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shadow-2xs font-medium"
                onClick={() => setIsSimulationModalOpen(true)}
              >
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <span>Simulasi / Pratinjau Layanan</span>
              </Button>

              <Button
                size="sm"
                className="h-8.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs font-medium"
                onClick={() => setIsAddComponentModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Komponen</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10 gap-1.5 font-medium"
                onClick={() => setIsResetDialogOpen(true)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Standar Resmi</span>
              </Button>
            </div>
          </div>

          {/* Service & Vehicle Navigation Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-border/70">
            {/* Service Type Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  "Tahunan",
                  "5 Tahunan",
                  "Balik Nama",
                  "Mutasi Antar Samsat",
                  "Mutasi Luar Daerah",
                ] as EstimationServiceType[]
              ).map((srv) => (
                <Button
                  key={srv}
                  type="button"
                  size="sm"
                  variant={selectedService === srv ? "default" : "outline"}
                  onClick={() => setSelectedService(srv)}
                  className={cn(
                    "h-7 text-xs font-medium px-3",
                    selectedService === srv ? "shadow-2xs" : "bg-background"
                  )}
                >
                  {srv === "Tahunan"
                    ? "Perpanjangan 1 Tahun"
                    : srv === "5 Tahunan"
                    ? "Perpanjangan 5 Tahun"
                    : srv}
                </Button>
              ))}
            </div>

            {/* Vehicle Type Switcher */}
            <div className="flex items-center gap-1 border border-border/70 p-1 rounded-lg bg-muted/30 self-start md:self-auto shrink-0">
              <Button
                type="button"
                variant={selectedVehicle === "Mobil" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedVehicle("Mobil")}
                className={cn("h-7 px-3 text-xs font-semibold", selectedVehicle === "Mobil" && "shadow-xs")}
              >
                Mobil (R4)
              </Button>
              <Button
                type="button"
                variant={selectedVehicle === "Motor" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedVehicle("Motor")}
                className={cn("h-7 px-3 text-xs font-semibold", selectedVehicle === "Motor" && "shadow-xs")}
              >
                Motor (R2)
              </Button>
            </div>
          </div>

          {/* Template Info & Metric Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-secondary/30 border border-border/60 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{activeTemplate.name}</span>
              <code className="text-[11px] bg-background/80 px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground font-mono">
                {activeTemplate.id}
              </code>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-background/80 text-xs font-normal border-border/80">
                Total Komponen: <strong className="ml-1 text-foreground font-semibold">{totalComponents}</strong>
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-normal">
                Aktif: <strong className="ml-1 font-semibold">{activeComponentsCount}</strong>
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-normal">
                Masuk Total: <strong className="ml-1 font-semibold">{includesInTotalCount}</strong>
              </Badge>
              {activeTemplate.updatedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Diperbarui: {new Date(activeTemplate.updatedAt).toLocaleDateString("id-ID")}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Structured Formula Parameters Form */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Parameter Rumus & Aturan Kebijakan (Structured Parameters)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Konfigurasi parameter matematis yang digunakan mesin estimasi. Tidak menggunakan eval string bebas demi keamanan sistem.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleSaveParameters}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs font-medium self-start sm:self-auto"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Parameter</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Koefisien Denda PKB */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Koefisien Denda PKB (%)</span>
                <span className="text-[11px] text-muted-foreground">Default: 48%</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  value={paramKoefisienDenda}
                  onChange={(e) => setParamKoefisienDenda(e.target.value)}
                  className="h-8.5 text-xs pr-7 font-semibold"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                  %
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tarif denda tahunan (misal 48% = 0.48, 50% = 0.50).
              </p>
            </div>

            {/* Pembagi Bulan Denda */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Pembagi Bulan Denda</span>
                <span className="text-[11px] text-muted-foreground">Default: 12</span>
              </Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={paramPembagiBulan}
                onChange={(e) => setParamPembagiBulan(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Pembagi bulan untuk prorata keterlambatan (12 bulan).
              </p>
            </div>

            {/* Kelipatan Pembulatan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Kelipatan Pembulatan</span>
                <span className="text-[11px] text-muted-foreground">Default: 1.000</span>
              </Label>
              <Input
                type="number"
                step="100"
                value={paramPembulatan}
                onChange={(e) => setParamPembulatan(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Pembulatan ke atas terdekat (kelipatan Rp 1.000).
              </p>
            </div>

            {/* Biaya Jasa Standar */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Biaya Jasa Standar</span>
                <span className="text-[11px] text-muted-foreground">Rp</span>
              </Label>
              <Input
                type="number"
                step="5000"
                value={paramBiayaJasa}
                onChange={(e) => setParamBiayaJasa(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Biaya jasa pengurusan dasar SUN89.
              </p>
            </div>

            {/* SWDKLLJ Pokok */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>SWDKLLJ Pokok (Rp)</span>
                <span className="text-[11px] text-muted-foreground">
                  {selectedVehicle === "Mobil" ? "R4: 143.000" : "R2: 35.000"}
                </span>
              </Label>
              <Input
                type="number"
                step="1000"
                value={paramSwdklljPokok}
                onChange={(e) => setParamSwdklljPokok(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Tarif premi pokok tahunan Jasa Raharja.
              </p>
            </div>

            {/* Denda SWDKLLJ Pokok */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Denda SWDKLLJ (Rp)</span>
                <span className="text-[11px] text-muted-foreground">
                  {selectedVehicle === "Mobil" ? "R4: 100.000" : "R2: 32.000"}
                </span>
              </Label>
              <Input
                type="number"
                step="1000"
                value={paramDendaSwdklljPokok}
                onChange={(e) => setParamDendaSwdklljPokok(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Denda keterlambatan SWDKLLJ per tahun terlambat.
              </p>
            </div>

            {/* Biaya Cetak SKP */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Biaya Cetak SKP (Rp)</span>
                <span className="text-[11px] text-muted-foreground">
                  {selectedVehicle === "Mobil" ? "R4: 100.000" : "R2: 50.000"}
                </span>
              </Label>
              <Input
                type="number"
                step="5000"
                value={paramBiayaCetakSkp}
                onChange={(e) => setParamBiayaCetakSkp(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                Dikenakan jika kendaraan memiliki tunggakan pajak.
              </p>
            </div>

            {/* Admin STNK (if applicable) */}
            {selectedService !== "Tahunan" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Admin STNK (Rp)</span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedVehicle === "Mobil" ? "R4: 200.000" : "R2: 100.000"}
                  </span>
                </Label>
                <Input
                  type="number"
                  step="5000"
                  value={paramAdminStnk}
                  onChange={(e) => setParamAdminStnk(e.target.value)}
                  className="h-8.5 text-xs font-semibold"
                />
                <p className="text-[10px] text-muted-foreground">
                  PNBP penerbitan STNK baru/5 tahunan.
                </p>
              </div>
            )}

            {/* Admin TNKB (if applicable) */}
            {selectedService !== "Tahunan" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Admin TNKB / Plat (Rp)</span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedVehicle === "Mobil" ? "R4: 100.000" : "R2: 60.000"}
                  </span>
                </Label>
                <Input
                  type="number"
                  step="5000"
                  value={paramAdminTnkb}
                  onChange={(e) => setParamAdminTnkb(e.target.value)}
                  className="h-8.5 text-xs font-semibold"
                />
                <p className="text-[10px] text-muted-foreground">
                  PNBP cetak plat nomor baru.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Component Rules Management Table */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Daftar Komponen Biaya Layanan ({activeTemplate.name})
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Aktifkan/nonaktifkan komponen, atur apakah komponen dijumlahkan ke total, dan sesuaikan tarif default.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-muted/40 font-normal self-start sm:self-auto">
              {activeTemplate.components.length} Komponen Terdaftar
            </Badge>
          </div>
        </CardHeader>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center text-xs font-semibold text-foreground bg-card">#</TableHead>
                <TableHead className="w-24 text-xs font-semibold text-foreground bg-card">Kode</TableHead>
                <TableHead className="min-w-[180px] text-xs font-semibold text-foreground bg-card">Nama Komponen</TableHead>
                <TableHead className="w-36 text-xs font-semibold text-foreground bg-card">Kategori</TableHead>
                <TableHead className="w-36 text-xs font-semibold text-foreground bg-card">Metode Perhitungan</TableHead>
                <TableHead className="w-32 text-right text-xs font-semibold text-foreground bg-card">Tarif Default</TableHead>
                <TableHead className="w-28 text-center text-xs font-semibold text-foreground bg-card">Status Aktif</TableHead>
                <TableHead className="w-28 text-center text-xs font-semibold text-foreground bg-card">Masuk Total</TableHead>
                <TableHead className="w-24 text-center text-xs font-semibold text-foreground bg-card">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTemplate.components
                .slice()
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((comp, idx) => {
                  const isCoreRule = comp.valueType === "formula" || Boolean(comp.ruleId);
                  const isManualOrCustom = comp.valueType === "manual" || comp.isEditable;
                  const catColor = CATEGORY_COLORS[comp.category] || "bg-muted text-foreground";
                  const methodText = CALC_METHOD_LABELS[comp.calculationMethod || (comp.valueType === "manual" ? "manual_amount" : comp.ruleId ? "formula_rule" : "fixed_amount")];

                  return (
                    <TableRow key={comp.id} className={cn(!comp.isActive && "opacity-55 bg-muted/20")}>
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">
                        {comp.displayOrder || idx + 1}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold text-foreground">
                        {comp.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground">{comp.name}</span>
                          {comp.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {comp.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[11px] font-medium border", catColor)}>
                          {CATEGORY_LABELS[comp.category] || comp.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground font-medium">{methodText}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-foreground">
                        {comp.defaultValue > 0 ? `Rp ${comp.defaultValue.toLocaleString("id-ID")}` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={comp.isActive}
                            onCheckedChange={() => handleToggleActive(comp.id)}
                            aria-label={`Toggle active ${comp.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={comp.includesInTotal}
                            disabled={!comp.isActive}
                            onCheckedChange={() => handleToggleIncludeInTotal(comp.id)}
                            aria-label={`Toggle include in total ${comp.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEditComponent(comp)}
                            title="Edit Komponen"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          {isManualOrCustom && !isCoreRule && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                              onClick={() => handleDeleteComponent(comp.id, comp.name)}
                              title="Hapus Komponen Kustom"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 4. Live Quick Simulation Strip (Direct feedback on parameter changes) */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                Pratinjau Kalkulasi Langsung (Live Calculation Strip)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Uji langsung efek perubahan parameter rumus dan status komponen terhadap hasil perhitungan akhir secara seketika.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExplanationModalOpen(true)}
              className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shadow-2xs font-medium self-start sm:self-auto"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Detail Rumus</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">PKB Terakhir (Rp)</Label>
              <Input
                type="number"
                value={simPkb}
                onChange={(e) => setSimPkb(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Jatuh Tempo PKB</Label>
              <Input
                type="date"
                value={simDueDate}
                onChange={(e) => setSimDueDate(e.target.value)}
                className="h-8.5 text-xs font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Program Samsat</Label>
              <Select value={simProgram} onValueChange={(val) => setSimProgram(val as ProgramSamsat)}>
                <SelectTrigger className="h-8.5 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">NORMAL</SelectItem>
                  <SelectItem value="FREE Biaya Denda">FREE Biaya Denda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 text-xs">
              <span className="text-muted-foreground block text-[11px]">Durasi Keterlambatan:</span>
              <span className="font-bold text-foreground">{quickPreviewResult.durasiKeterlambatan}</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-border/70 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[10px] block">Total PKB Pokok</span>
              <span className="font-semibold text-foreground text-xs">
                Rp {quickPreviewResult.totalPkb.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[10px] block">Total Denda PKB</span>
              <span className="font-semibold text-red-600 dark:text-red-400 text-xs">
                Rp {quickPreviewResult.totalDendaPkb.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[10px] block">SWDKLLJ Pokok</span>
              <span className="font-semibold text-foreground text-xs">
                Rp {quickPreviewResult.totalSwdkllj.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[10px] block">Denda SWDKLLJ</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 text-xs">
                Rp {quickPreviewResult.totalDendaSwdkllj.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[10px] block">Admin & Jasa</span>
              <span className="font-semibold text-foreground text-xs">
                Rp {quickPreviewResult.totalAdminDanJasa.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-primary font-medium text-[10px] block">Total Estimasi Akhir</span>
              <span className="font-bold text-primary text-sm">
                Rp {quickPreviewResult.totalEstimasi.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: Edit Component Modal */}
      <Dialog open={isEditComponentModalOpen} onOpenChange={setIsEditComponentModalOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Edit Komponen: {selectedComponent?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sesuaikan nama, kategori, tarif default, dan aturan kalkulasi komponen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nama Komponen</Label>
              <Input
                value={editCompData.name}
                onChange={(e) => setEditCompData((prev) => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kategori</Label>
                <Select
                  value={editCompData.category}
                  onValueChange={(val) => setEditCompData((prev) => ({ ...prev, category: val as ComponentCategory }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as ComponentCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Metode Perhitungan</Label>
                <Select
                  value={editCompData.calculationMethod}
                  onValueChange={(val) => setEditCompData((prev) => ({ ...prev, calculationMethod: val as CalculationMethod }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CALC_METHOD_LABELS) as CalculationMethod[]).map((method) => (
                      <SelectItem key={method} value={method}>
                        {CALC_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tarif Default (Rp)</Label>
              <Input
                type="number"
                value={editCompData.defaultValue}
                onChange={(e) => setEditCompData((prev) => ({ ...prev, defaultValue: e.target.value }))}
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Keterangan Bisnis / Catatan</Label>
              <Input
                value={editCompData.description}
                onChange={(e) => setEditCompData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi fungsi biaya..."
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Status Komponen</Label>
                <p className="text-[11px] text-muted-foreground">Aktifkan atau nonaktifkan komponen ini</p>
              </div>
              <Switch
                checked={editCompData.isActive}
                onCheckedChange={(checked) => setEditCompData((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Masuk ke Total Estimasi</Label>
                <p className="text-[11px] text-muted-foreground">Jika nonaktif, biaya hanya tampil sebagai info</p>
              </div>
              <Switch
                checked={editCompData.includesInTotal}
                disabled={!editCompData.isActive}
                onCheckedChange={(checked) => setEditCompData((prev) => ({ ...prev, includesInTotal: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsEditComponentModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveEditedComponent} className="bg-primary text-primary-foreground">
              Simpan Komponen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Component Modal */}
      <Dialog open={isAddComponentModalOpen} onOpenChange={setIsAddComponentModalOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Tambah Komponen Biaya Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan komponen biaya kustom untuk {activeTemplate.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-medium">Kode</Label>
                <Input
                  value={newCompData.code}
                  onChange={(e) => setNewCompData((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="ADM-01"
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Nama Komponen</Label>
                <Input
                  value={newCompData.name}
                  onChange={(e) => setNewCompData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: Materai Surat Kuasa"
                  className="h-8 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kategori</Label>
                <Select
                  value={newCompData.category}
                  onValueChange={(val) => setNewCompData((prev) => ({ ...prev, category: val as ComponentCategory }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as ComponentCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Metode Perhitungan</Label>
                <Select
                  value={newCompData.calculationMethod}
                  onValueChange={(val) => setNewCompData((prev) => ({ ...prev, calculationMethod: val as CalculationMethod }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_amount">Biaya Tetap</SelectItem>
                    <SelectItem value="manual_amount">Nilai Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tarif Default (Rp)</Label>
              <Input
                type="number"
                value={newCompData.defaultValue}
                onChange={(e) => setNewCompData((prev) => ({ ...prev, defaultValue: e.target.value }))}
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Keterangan Bisnis</Label>
              <Input
                value={newCompData.description}
                onChange={(e) => setNewCompData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Keterangan komponen..."
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Masuk ke Total Estimasi</Label>
                <p className="text-[11px] text-muted-foreground">Sertakan dalam penjumlahan total tagihan</p>
              </div>
              <Switch
                checked={newCompData.includesInTotal}
                onCheckedChange={(checked) => setNewCompData((prev) => ({ ...prev, includesInTotal: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsAddComponentModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleAddNewComponent} className="bg-primary text-primary-foreground">
              Tambah Komponen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Reset Confirmation Alert Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reset ke Standar Resmi (Default Workbook)?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin mengembalikan seluruh parameter rumus dan komponen template{" "}
              <strong className="text-foreground">{activeTemplate.name}</strong> ke formula acuan resmi
              workbook Excel? Perubahan kustom yang belum disimpan akan dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs h-8">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              Ya, Reset ke Standar Resmi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: Full Simulation Calculator Modal */}
      <Dialog open={isSimulationModalOpen} onOpenChange={setIsSimulationModalOpen}>
        <DialogContent className="border-border sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b border-border/70">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calculator className="w-5 h-5 text-primary" />
              Simulasi Kalkulator: {activeTemplate.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Simulasi perhitungan lengkap dengan parameter Master Data yang sedang aktif.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            {selectedService === "Tahunan" ? (
              selectedVehicle === "Mobil" ? (
                <EstimatorR4Tahunan />
              ) : (
                <EstimatorR2Tahunan />
              )
            ) : (
              <EstimatorExtended
                key={`${selectedService}-${selectedVehicle}`}
                defaultServiceType={
                  selectedService === "5 Tahunan"
                    ? "5 Tahunan"
                    : selectedService === "Balik Nama"
                    ? "Balik Nama"
                    : selectedService === "Mutasi Antar Samsat"
                    ? "Mutasi Antar Samsat"
                    : "Mutasi Luar Daerah"
                }
                defaultVehicleType={selectedVehicle}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Calculation Explanation Modal */}
      <CalculationExplanationModal
        open={isExplanationModalOpen}
        onOpenChange={setIsExplanationModalOpen}
        estimationResult={quickPreviewResult}
        template={activeTemplate}
        vehicleType={selectedVehicle}
        serviceType={selectedService}
        pkbDasar={parseFloat(simPkb) || 0}
        tanggalJatuhTempo={simDueDate}
        programSamsat={simProgram}
      />
    </div>
  );
}
