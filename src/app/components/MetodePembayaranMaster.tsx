/**
 * Master Data — CRUD Metode Pembayaran
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
import { EnhancedTable, Column } from "./EnhancedTable";
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Building,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Power,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { usePaymentMethods, PaymentMethod } from "../data/paymentMethodStore";

const METODE_PEMBAYARAN_OPTIONS = [
  "Transfer Bank",
  "Tunai",
] as const;

export function MetodePembayaranMaster() {
  const { methods, isLoading, error, isStale, refresh, addMethod, updateMethod, deleteMethod } = usePaymentMethods();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentMethod | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState<boolean>(false);
  const [discardTargetType, setDiscardTargetType] = useState<"edit" | "add" | null>(null);

  const [formData, setFormData] = useState({
    nama_metode: "Transfer Bank",
    bank: "",
    nama_rekening: "",
    nomor_rekening: "",
    status: "Aktif" as "Aktif" | "Nonaktif",
  });

  const isFormDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return JSON.stringify(formData) !== initialSnapshot;
  }, [formData, initialSnapshot]);

  const handleCancelAdd = () => {
    if (isFormDirty) {
      setDiscardTargetType("add");
      setIsDiscardDialogOpen(true);
    } else {
      setIsAddOpen(false);
    }
  };

  const handleCancelEdit = () => {
    if (isFormDirty) {
      setDiscardTargetType("edit");
      setIsDiscardDialogOpen(true);
    } else {
      setIsEditOpen(false);
    }
  };

  const handleConfirmDiscard = () => {
    if (discardTargetType === "add") {
      setIsAddOpen(false);
    } else if (discardTargetType === "edit") {
      setIsEditOpen(false);
    }
    setIsDiscardDialogOpen(false);
    setDiscardTargetType(null);
  };

  const isCash = formData.nama_metode === "Tunai";

  const handleMetodeChange = (val: string) => {
    if (val === "Tunai") {
      setFormData((prev) => ({
        ...prev,
        nama_metode: "Tunai",
        bank: "Tunai",
        nama_rekening: "",
        nomor_rekening: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        nama_metode: "Transfer Bank",
        bank: prev.bank === "Tunai" ? "" : prev.bank,
      }));
    }
  };

  const handleOpenAdd = () => {
    const defaultData = {
      nama_metode: "Transfer Bank",
      bank: "",
      nama_rekening: "",
      nomor_rekening: "",
      status: "Aktif" as "Aktif" | "Nonaktif",
    };
    setFormData(defaultData);
    setInitialSnapshot(JSON.stringify(defaultData));
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item: PaymentMethod) => {
    setSelectedItem(item);
    let mappedMetode = item.nama_metode;
    const isItemCash =
      mappedMetode.toLowerCase().includes("tunai") ||
      mappedMetode.toLowerCase().includes("cash") ||
      (item.bank && (item.bank.toLowerCase().includes("tunai") || item.bank.toLowerCase().includes("cash")));

    mappedMetode = isItemCash ? "Tunai" : "Transfer Bank";

    const initialData = {
      nama_metode: mappedMetode,
      bank: isItemCash ? "Tunai" : (item.bank || ""),
      nama_rekening: isItemCash ? "" : (item.nama_rekening || ""),
      nomor_rekening: isItemCash ? "" : (item.nomor_rekening || ""),
      status: item.status,
    };
    setFormData(initialData);
    setInitialSnapshot(JSON.stringify(initialData));
    setIsEditOpen(true);
  };

  const handleOpenDelete = (item: PaymentMethod) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleToggleStatus = async (item: PaymentMethod) => {
    const nextStatus = item.status === "Aktif" ? "Nonaktif" : "Aktif";
    try {
      await updateMethod(item.id, { status: nextStatus });
      toast.success(
        `Metode pembayaran '${item.nama_metode}' berhasil diubah menjadi ${nextStatus}.`
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status metode pembayaran.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_metode.trim()) {
      toast.error("Metode pembayaran wajib dipilih!");
      return;
    }

    if (formData.nama_metode === "Tunai") {
      try {
        await addMethod({
          nama_metode: "Tunai",
          bank: "Tunai",
          nama_rekening: "",
          nomor_rekening: "",
          status: formData.status,
        });
        toast.success("Metode pembayaran 'Tunai' berhasil ditambahkan!");
        setIsAddOpen(false);
      } catch (err: any) {
        toast.error(err.message || "Gagal menambahkan metode pembayaran.");
      }
      return;
    }

    // Transfer Bank validation
    if (!formData.bank.trim()) {
      toast.error("Bank / Penyedia wajib diisi untuk transfer bank!");
      return;
    }
    if (!formData.nama_rekening.trim()) {
      toast.error("Nama pemilik rekening wajib diisi untuk transfer bank!");
      return;
    }
    if (!formData.nomor_rekening.trim()) {
      toast.error("Nomor rekening wajib diisi untuk transfer bank!");
      return;
    }

    try {
      await addMethod({
        nama_metode: "Transfer Bank",
        bank: formData.bank.trim(),
        nama_rekening: formData.nama_rekening.trim(),
        nomor_rekening: formData.nomor_rekening.trim(),
        status: formData.status,
      });
      toast.success(`Metode pembayaran 'Transfer Bank (${formData.bank.trim()})' berhasil ditambahkan!`);
      setIsAddOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan metode pembayaran.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (!formData.nama_metode.trim()) {
      toast.error("Metode pembayaran wajib dipilih!");
      return;
    }

    if (formData.nama_metode === "Tunai") {
      try {
        await updateMethod(selectedItem.id, {
          nama_metode: "Tunai",
          bank: "Tunai",
          nama_rekening: "",
          nomor_rekening: "",
          status: formData.status,
        });
        toast.success("Metode pembayaran 'Tunai' berhasil diperbarui!");
        setIsEditOpen(false);
        setSelectedItem(null);
      } catch (err: any) {
        toast.error(err.message || "Gagal memperbarui metode pembayaran.");
      }
      return;
    }

    // Transfer Bank validation
    if (!formData.bank.trim()) {
      toast.error("Bank / Penyedia wajib diisi untuk transfer bank!");
      return;
    }
    if (!formData.nama_rekening.trim()) {
      toast.error("Nama pemilik rekening wajib diisi untuk transfer bank!");
      return;
    }
    if (!formData.nomor_rekening.trim()) {
      toast.error("Nomor rekening wajib diisi untuk transfer bank!");
      return;
    }

    try {
      await updateMethod(selectedItem.id, {
        nama_metode: "Transfer Bank",
        bank: formData.bank.trim(),
        nama_rekening: formData.nama_rekening.trim(),
        nomor_rekening: formData.nomor_rekening.trim(),
        status: formData.status,
      });
      toast.success(`Metode pembayaran 'Transfer Bank (${formData.bank.trim()})' berhasil diperbarui!`);
      setIsEditOpen(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui metode pembayaran.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    try {
      const res = await deleteMethod(selectedItem.id);
      if (res.deactivated) {
        toast.info(res.message || `Metode '${selectedItem.nama_metode}' dinonaktifkan.`);
      } else {
        toast.success(res.message || `Metode '${selectedItem.nama_metode}' berhasil dihapus.`);
      }
      setIsDeleteOpen(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus metode pembayaran.");
    }
  };

  const columns: Column[] = [
    {
      key: "nama_metode",
      label: "Metode Pembayaran",
      filterable: true,
      filterType: "text",
      render: (val: string, item: PaymentMethod) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-foreground text-xs">{val}</span>
        </div>
      ),
    },
    {
      key: "bank",
      label: "Bank / Saluran",
      filterable: true,
      filterType: "text",
      render: (val: string, item: PaymentMethod) => {
        const isCashItem =
          item?.nama_metode?.toLowerCase().includes("tunai") ||
          item?.nama_metode?.toLowerCase().includes("cash") ||
          val?.toLowerCase() === "tunai" ||
          val?.toLowerCase() === "cash";
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted border border-border text-foreground">
            {isCashItem ? "Tunai (Kas Kantor)" : val}
          </span>
        );
      },
    },
    {
      key: "nama_rekening",
      label: "Nama Pemilik Rekening",
      render: (val: string, item: PaymentMethod) => {
        const isCashItem =
          item?.nama_metode?.toLowerCase().includes("tunai") ||
          item?.nama_metode?.toLowerCase().includes("cash");
        return (
          <span className="text-xs text-foreground">
            {isCashItem ? "-" : (val || "-")}
          </span>
        );
      },
    },
    {
      key: "nomor_rekening",
      label: "Nomor Rekening",
      render: (val: string, item: PaymentMethod) => {
        const isCashItem =
          item?.nama_metode?.toLowerCase().includes("tunai") ||
          item?.nama_metode?.toLowerCase().includes("cash");
        return isCashItem ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
          <span className="font-mono text-xs font-semibold text-primary">
            {val || "-"}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      filterable: true,
      filterType: "select",
      filterOptions: ["Aktif", "Nonaktif"],
      render: (val: string) => {
        const isAktif = val === "Aktif";
        return (
          <Badge
            variant="outline"
            className={
              isAktif
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold"
                : "bg-muted text-muted-foreground border-border text-[11px] font-medium"
            }
          >
            {isAktif ? (
              <CheckCircle2 className="w-3 h-3 mr-1 inline" />
            ) : (
              <XCircle className="w-3 h-3 mr-1 inline" />
            )}
            {val}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Metode Pembayaran
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola daftar rekening penerimaan resmi dan saluran pembayaran yang digunakan dalam Buat Order dan Finance
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Tambah Metode Pembayaran
        </Button>
      </div>

      {/* Main Table Card / Loading / Error State */}
      {isLoading && methods.length === 0 ? (
        <Card className="p-8 border border-border/80 bg-card shadow-xs flex-1 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Memuat data metode pembayaran dari database...</p>
          <p className="text-xs text-muted-foreground mt-1">Menghubungkan ke API server...</p>
        </Card>
      ) : error && methods.length === 0 ? (
        <Card className="p-8 border border-red-500/20 bg-red-500/5 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Gagal Memuat Metode Pembayaran</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="mt-4 gap-2 border-border text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </Button>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs flex-1 flex flex-col min-h-0">
          {isStale && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Peringatan Sinkronisasi:</strong> Gagal memperbarui data dari server ({error}). Menampilkan data cache lokal terakhir.
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refresh()}
                className="h-7 text-xs gap-1 hover:bg-amber-500/20"
              >
                <RefreshCw className="w-3 h-3" />
                Coba Sinkron Ulang
              </Button>
            </div>
          )}
          <EnhancedTable
            columns={columns}
            data={methods}
            searchPlaceholder="Cari nama metode, bank, nomor rekening..."
            itemsPerPageOptions={[10, 25, 50]}
            onEdit={(item: PaymentMethod) => handleOpenEdit(item)}
            onDelete={(item: PaymentMethod) => handleOpenDelete(item)}
          />
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) handleCancelAdd(); }}>
        <DialogContent className="sm:max-w-lg border-border bg-card">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>Tambah Metode Pembayaran</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Masukkan nama metode, bank, nomor rekening, dan status operasional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                Data Metode Pembayaran
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">
                  Metode Pembayaran <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.nama_metode}
                  onValueChange={handleMetodeChange}
                >
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {METODE_PEMBAYARAN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isCash ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Bank / Penyedia <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: BCA / Mandiri / BRI"
                      value={formData.bank}
                      onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-normal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Status Awal</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktif" className="text-xs">Aktif</SelectItem>
                        <SelectItem value="Nonaktif" className="text-xs">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Status Awal</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktif" className="text-xs">Aktif</SelectItem>
                      <SelectItem value="Nonaktif" className="text-xs">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!isCash && (
              <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  Informasi Rekening Bank
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Nama Pemilik Rekening (a.n.) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: PT Biro Jasa SUN89 Abadi"
                      value={formData.nama_rekening}
                      onChange={(e) => setFormData({ ...formData, nama_rekening: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-normal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Nomor Rekening <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: 772-019-2831"
                      value={formData.nomor_rekening}
                      onChange={(e) => setFormData({ ...formData, nomor_rekening: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-mono font-normal"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelAdd}
                className="text-xs h-9 px-4"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-4 font-semibold shadow-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Metode</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
        <DialogContent className="sm:max-w-lg border-border bg-card">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Edit className="w-4 h-4 text-primary" />
              <span>Edit Metode Pembayaran</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ubah rincian informasi metode, nomor rekening, atau status operasional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                Data Metode Pembayaran
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">
                  Metode Pembayaran <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.nama_metode}
                  onValueChange={handleMetodeChange}
                >
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {METODE_PEMBAYARAN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isCash ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Bank / Penyedia <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: BCA / Mandiri / BRI"
                      value={formData.bank}
                      onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-normal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Status Operasional</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktif" className="text-xs">Aktif</SelectItem>
                        <SelectItem value="Nonaktif" className="text-xs">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Status Operasional</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs font-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktif" className="text-xs">Aktif</SelectItem>
                      <SelectItem value="Nonaktif" className="text-xs">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!isCash && (
              <div className="space-y-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  Informasi Rekening Bank
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Nama Pemilik Rekening (a.n.) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: PT Biro Jasa SUN89 Abadi"
                      value={formData.nama_rekening}
                      onChange={(e) => setFormData({ ...formData, nama_rekening: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-normal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">
                      Nomor Rekening <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Contoh: 772-019-2831"
                      value={formData.nomor_rekening}
                      onChange={(e) => setFormData({ ...formData, nomor_rekening: e.target.value })}
                      className="bg-input-background border-border h-9 text-xs font-mono font-normal"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="text-xs h-9 px-4"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-4 font-semibold shadow-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </Button>
            </DialogFooter>
          </form>
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
              Anda memiliki konfigurasi metode pembayaran yang telah diubah namun belum disimpan. Jika Anda membatalkan sekarang, semua perubahan yang Anda lakukan akan dibuang.
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

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Hapus / Nonaktifkan Metode Pembayaran?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Anda akan menghapus metode pembayaran{" "}
                <strong className="text-foreground">{selectedItem?.nama_metode}</strong> (
                {selectedItem?.bank} - {selectedItem?.nomor_rekening || "Tanpa Rekening"}).
              </p>
              <p className="p-2.5 rounded bg-muted/40 border border-border text-[11px] leading-relaxed">
                <strong className="text-foreground">Proteksi Integritas Transaksi:</strong> Jika metode ini sudah pernah digunakan oleh transaksi lama, sistem akan secara otomatis <strong>menonaktifkannya</strong> (bukan menghapus permanen) agar histori transaksi lama tetap utuh. Jika belum pernah digunakan, metode akan dihapus permanen.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8 px-3">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8 px-3"
            >
              Lanjutkan Penghapusan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
