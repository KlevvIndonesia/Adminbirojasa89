/**
 * Master Data — Layanan & Persyaratan Dokumen (Requirements)
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Edit3,
  FileCheck2,
  Plus,
  X,
  RefreshCw,
  Loader2,
  FileText,
  CheckCircle2,
  Info,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useServiceStore, ServiceItem } from "../data/serviceStore";

export function MasterLayanan() {
  const { services, isLoading, refreshServices, updateService } = useServiceStore();

  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  // Form states inside edit dialog
  const [formNama, setFormNama] = useState("");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formRequirements, setFormRequirements] = useState<string[]>([]);
  const [formStatusAktif, setFormStatusAktif] = useState(true);
  const [newDocInput, setNewDocInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sorted services based on urutan
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => a.urutan - b.urutan);
  }, [services]);

  const handleOpenEdit = (svc: ServiceItem) => {
    setEditingService(svc);
    setFormNama(svc.nama_layanan);
    setFormDeskripsi(svc.deskripsi || "");
    setFormRequirements([...(svc.requirements || [])]);
    setFormStatusAktif(svc.status_aktif === 1);
    setNewDocInput("");
  };

  const handleAddRequirement = (docName: string) => {
    const trimmed = docName.trim();
    if (!trimmed) return;
    if (formRequirements.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`Dokumen '${trimmed}' sudah ada di dalam daftar.`);
      return;
    }
    setFormRequirements((prev) => [...prev, trimmed]);
    setNewDocInput("");
  };

  const handleRemoveRequirement = (index: number) => {
    setFormRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editingService) return;

    setIsSaving(true);
    try {
      const res = await updateService(editingService.id, {
        nama_layanan: editingService.nama_layanan,
        deskripsi: formDeskripsi.trim(),
        requirements: formRequirements,
        status_aktif: formStatusAktif ? 1 : 0,
      });

      if (res.success) {
        toast.success(`Layanan '${editingService.nama_layanan}' berhasil diperbarui.`);
        setEditingService(null);
      } else {
        toast.error(res.error || "Gagal memperbarui layanan.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 w-full min-w-0">
      {/* Action Toolbar: Service Count & Segarkan Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-card border-border/80 text-foreground">
            {services.length} Layanan
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Katalog layanan terdaftar
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshServices()}
          disabled={isLoading}
          className="h-9 text-xs gap-1.5 font-medium bg-card border-border/80 hover:bg-accent"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Segarkan
        </Button>
      </div>

      {/* Services Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedServices.map((svc) => {
          const reqCount = svc.requirements?.length || 0;

          return (
            <Card
              key={svc.id}
              className="p-5 border-border/80 hover:border-primary/40 transition-all duration-200 bg-card hover:shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Card Top: Code, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-[11px] font-normal px-2 py-0.5 border">
                      {svc.kode_layanan}
                    </Badge>
                  </div>
                  <Badge
                    variant={svc.status_aktif === 1 ? "default" : "secondary"}
                    className={`text-[10px] font-medium px-2 py-0.5 ${
                      svc.status_aktif === 1 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "opacity-60"
                    }`}
                  >
                    {svc.status_aktif === 1 ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                {/* Service Name & Description */}
                <div>
                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight leading-snug">
                    {svc.nama_layanan}
                  </h3>
                  <p className="text-xs font-normal text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {svc.deskripsi || "Belum ada deskripsi layanan."}
                  </p>
                </div>

                {/* Requirements / Dokumen yang dibutuhkan */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                      Dokumen yang Dibutuhkan ({reqCount}):
                    </span>
                    {reqCount === 0 && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
                        Belum ada dokumen disetel
                      </span>
                    )}
                  </div>

                  {reqCount > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {svc.requirements.map((doc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/60 text-foreground border border-border/60 leading-normal"
                        >
                          <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="break-words">{doc}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic font-normal">
                      Klik "Edit Layanan" untuk menambahkan poin-poin dokumen persyaratan.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-[11px] font-normal text-muted-foreground">
                  ID: <span className="font-mono text-muted-foreground/80 font-normal">{svc.id}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEdit(svc)}
                  className="h-8 text-xs font-medium gap-1.5 hover:border-primary/50 hover:bg-primary/5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  Edit Layanan
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* DIALOG EDIT LAYANAN */}
      <Dialog open={!!editingService} onOpenChange={(open) => { if (!open && !isSaving) setEditingService(null); }}>
        <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit Layanan: {editingService?.kode_layanan}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sesuaikan nama resmi layanan, keterangan deskripsi, serta poin-poin dokumen persyaratan pengurusan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            {/* Nama Layanan (Read-Only Baku) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Nama Layanan Resmi</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-normal">
                  <Lock className="w-3 h-3 text-muted-foreground/70" /> Terkunci (Read-Only)
                </span>
              </Label>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/40 text-foreground font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1">{editingService?.nama_layanan}</span>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                  {editingService?.kode_layanan}
                </Badge>
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Deskripsi Layanan
              </Label>
              <Textarea
                rows={2}
                value={formDeskripsi}
                onChange={(e) => setFormDeskripsi(e.target.value)}
                placeholder="Jelaskan proses atau detail layanan ini..."
                className="text-xs"
              />
            </div>

            {/* Dokumen Requirements (Editor Poin-poin) */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-primary" />
                    Persyaratan Dokumen (Requirements)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Poin-poin berkas yang wajib disiapkan pelanggan dan dibawa oleh kurir saat operasional.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs font-mono font-semibold">
                  {formRequirements.length} Poin
                </Badge>
              </div>

              {/* Current Points List */}
              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 min-h-[70px] space-y-2">
                {formRequirements.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {formRequirements.map((req, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-card text-foreground border border-border shadow-2xs group leading-normal max-w-full"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="break-words">{req}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(idx)}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors ml-0.5 shrink-0 mt-0.5"
                          title="Hapus dokumen ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground flex flex-col items-center gap-1">
                    <Info className="w-4 h-4 text-muted-foreground/60" />
                    <span>Belum ada poin dokumen. Tambahkan dokumen pada formulir di bawah.</span>
                  </div>
                )}
              </div>

              {/* Input New Document Point */}
              <div className="flex items-center gap-2">
                <Input
                  value={newDocInput}
                  onChange={(e) => setNewDocInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRequirement(newDocInput);
                    }
                  }}
                  placeholder="Ketik nama dokumen (tekan Enter untuk menambah)..."
                  className="text-xs h-9"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddRequirement(newDocInput)}
                  disabled={!newDocInput.trim()}
                  className="h-9 px-3 text-xs font-semibold gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </Button>
              </div>
            </div>

            {/* Status Aktif Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <Label className="text-xs font-semibold text-foreground block">
                  Status Layanan
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Layanan aktif akan tampil dalam pilihan order pelanggan dan kalkulasi Samsat.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formStatusAktif}
                  onCheckedChange={setFormStatusAktif}
                />
                <span className={`text-xs font-semibold ${formStatusAktif ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {formStatusAktif ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => setEditingService(null)}
              className="h-9 text-xs px-4"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="h-9 text-xs px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
