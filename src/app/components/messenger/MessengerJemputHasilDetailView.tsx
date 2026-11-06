import React, { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  Building2,
  Phone,
  User,
  Car,
} from "lucide-react";
import {
  MessengerTaskItem,
  UserContext,
  reportSamsatPickupKendalaAction,
  completeSamsatPickupTaskAction,
} from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerJemputHasilDetailViewProps {
  task: MessengerTaskItem;
  currentUser: UserContext;
  onBack: () => void;
  onTaskUpdated?: () => void;
}

export function MessengerJemputHasilDetailView({
  task,
  currentUser,
  onBack,
  onTaskUpdated,
}: MessengerJemputHasilDetailViewProps) {
  const { activeOrders } = useOrderStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKendalaConfirm, setShowKendalaConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Look up latest operational order from orderStore
  const allOrders = Object.values(activeOrders).flat();
  const currentOrder = allOrders.find((o) => o.orderNo === task.orderNo) || (task.rawOrder as any);

  const pickupStatus = currentOrder?.samsatPickupStatus || "Sedang Jemput Dokumen Samsat";
  const isTerkendala = pickupStatus === "Terkendala";
  const isCompleted = pickupStatus === "Dokumen Samsat Diterima di Kantor";

  const handleReportKendala = async () => {
    setIsSubmitting(true);
    try {
      const res = await reportSamsatPickupKendalaAction(task.orderNo, currentUser);
      if (res.success) {
        toast.warning(`Kendala pada penjemputan hasil order ${task.orderNo} berhasil dilaporkan.`);
        setShowKendalaConfirm(false);
        onTaskUpdated?.();
      } else {
        toast.error(res.error || "Gagal melaporkan kendala.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat melaporkan kendala.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteHandover = async () => {
    setIsSubmitting(true);
    try {
      const res = await completeSamsatPickupTaskAction(task.orderNo, currentUser);
      if (res.success) {
        toast.success(`Dokumen hasil Samsat order ${task.orderNo} berhasil diserahkan ke kantor!`);
        setShowCompleteConfirm(false);
        onTaskUpdated?.();
      } else {
        toast.error(res.error || "Gagal menyerahkan dokumen ke kantor.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyelesaikan penyerahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-28 text-left animate-in fade-in duration-200">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2 h-10 px-3 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar</span>
        </Button>
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
          {task.orderNo}
        </span>
      </div>

      {/* Hero Card */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Penjemputan Berkas
            </span>
            <h1 className="text-xl font-bold text-foreground mt-0.5">
              Jemput Hasil Samsat
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ambil notice pajak & STNK dari Samsat dan serahkan ke kantor
            </p>
          </div>
          <div>
            {isCompleted ? (
              <Badge status="success" className="px-2.5 py-1 text-xs">
                Diserahkan ke Kantor
              </Badge>
            ) : isTerkendala ? (
              <Badge status="error" className="px-2.5 py-1 text-xs bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                Terkendala
              </Badge>
            ) : (
              <Badge status="info" className="px-2.5 py-1 text-xs">
                Sedang Menjemput
              </Badge>
            )}
          </div>
        </div>

        {/* Nopol & Customer Pill */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/60 text-sm">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Car className="w-4 h-4 text-primary shrink-0" />
            <span>{currentOrder?.nopol || task.nopol || "-"}</span>
          </div>
          <span className="text-muted-foreground">•</span>
          <div className="text-muted-foreground truncate">
            {currentOrder?.layanan || task.jenisTugas || "-"}
          </div>
        </div>
      </div>

      {/* Terkendala Alert Banner */}
      {isTerkendala && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              Penjemputan Dalam Status Terkendala
            </h4>
            <p className="leading-relaxed">
              Anda telah menandai tugas ini terkendala. Penyerahan dokumen ke kantor dinonaktifkan sementara hingga Admin atau Supervisor melakukan recovery pada sistem.
            </p>
          </div>
        </div>
      )}

      {/* Completed Success Banner */}
      {isCompleted && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
              Dokumen Berhasil Diterima di Kantor
            </h4>
            <p className="leading-relaxed">
              Seluruh berkas hasil pengurusan Samsat telah diserahkan dan tercatat diterima di kantor pada{" "}
              <strong>
                {currentOrder?.samsatPickupCompletedAt
                  ? new Date(currentOrder.samsatPickupCompletedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      {/* Card 1: Informasi Pelanggan & Kendaraan */}
      <Card className="p-4 sm:p-5 rounded-2xl border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Informasi Klien & Kendaraan
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block mb-0.5">Nama Pelanggan</span>
            <span className="font-medium text-foreground text-sm">
              {currentOrder?.customer || task.customer || "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">Nomor HP / WhatsApp</span>
            <span className="font-medium text-foreground text-sm flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              {currentOrder?.nomorHP || task.phone || "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">Plat Nomor (Nopol)</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {currentOrder?.nopol || task.nopol || "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">Jenis Kendaraan</span>
            <span className="font-medium text-foreground text-sm">
              {currentOrder?.jenisKendaraan || "-"}
            </span>
          </div>
        </div>
      </Card>

      {/* Card 2: Informasi Samsat & Catatan Operasional */}
      <Card className="p-4 sm:p-5 rounded-2xl border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Lokasi Samsat & Instruksi Kantor
        </h3>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-muted-foreground block mb-0.5">Lokasi Pengurusan Samsat</span>
            <span className="font-semibold text-foreground text-sm">
              {currentOrder?.wilayahSamsatAsal
                ? currentOrder.wilayahSamsatAsal.toLowerCase().includes("samsat")
                  ? currentOrder.wilayahSamsatAsal
                  : `Samsat ${currentOrder.wilayahSamsatAsal}`
                : "Samsat Wilayah"}
            </span>
          </div>

          <div className="pt-2 border-t border-border/60">
            <span className="text-muted-foreground block mb-1">Catatan Operasional Samsat</span>
            <div className="p-3 rounded-xl bg-muted/50 border border-border/60 text-muted-foreground text-xs leading-relaxed italic">
              {currentOrder?.catatanSamsat || currentOrder?.samsatPickupNotes || "Ambil dokumen hasil pengurusan dari Samsat dan serahkan ke bagian verifikasi kantor."}
            </div>
          </div>
        </div>
      </Card>

      {/* Card 3: Riwayat Waktu Pelaksanaan */}
      <Card className="p-4 sm:p-5 rounded-2xl border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Waktu Pelaksanaan Tugas
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block mb-0.5">Petugas Penjemput</span>
            <span className="font-medium text-foreground">
              {currentOrder?.samsatPickupMessengerNama || task.messenger || currentUser.userName}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">Waktu Mulai Jemput</span>
            <span className="font-medium text-foreground">
              {currentOrder?.samsatPickupStartedAt
                ? new Date(currentOrder.samsatPickupStartedAt).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "-"}
            </span>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal: Kendala */}
      {showKendalaConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Laporkan Kendala?</h4>
                <p className="text-xs text-muted-foreground">Konfirmasi status kendala penjemputan berkas</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Status penjemputan akan diubah menjadi <strong>Terkendala</strong> dan dilaporkan ke timeline order. Penyerahan dokumen ke kantor akan ditangguhkan sampai Admin atau Supervisor menyelesaikan kendala ini.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKendalaConfirm(false)}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReportKendala}
                disabled={isSubmitting}
                className="min-h-[44px] font-semibold"
              >
                {isSubmitting ? "Menyimpan..." : "Ya, Laporkan Kendala"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Serahkan ke Kantor */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Serahkan Dokumen ke Kantor?</h4>
                <p className="text-xs text-muted-foreground">Konfirmasi serah terima berkas hasil Samsat</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pastikan notice pajak asli, STNK baru, dan dokumen pendukung lainnya telah lengkap diserahkan ke bagian loket / verifikasi kantor.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompleteConfirm(false)}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleCompleteHandover}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] font-semibold"
              >
                {isSubmitting ? "Menyerahkan..." : "Ya, Dokumen Sudah Diserahkan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Action Bar — STRICTLY 2 ACTIONS, ZERO TEXTAREAS */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {/* Action 1: Kendala */}
          <Button
            type="button"
            variant="outline"
            disabled={isTerkendala || isCompleted || isSubmitting}
            onClick={() => setShowKendalaConfirm(true)}
            className={cn(
              "flex-1 min-h-[48px] rounded-xl font-bold border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400 text-sm",
              (isTerkendala || isCompleted) && "opacity-50 cursor-not-allowed"
            )}
          >
            <AlertTriangle className="w-4 h-4 mr-2 text-red-500 shrink-0" />
            {isTerkendala ? "Sedang Terkendala" : "Kendala"}
          </Button>

          {/* Action 2: Dokumen Diserahkan ke Kantor */}
          <Button
            type="button"
            disabled={isTerkendala || isCompleted || isSubmitting}
            onClick={() => setShowCompleteConfirm(true)}
            className={cn(
              "flex-[1.6] min-h-[48px] rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-md transition-all",
              (isTerkendala || isCompleted) && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
            {isCompleted ? "Sudah di Kantor" : "Dokumen Diserahkan ke Kantor"}
          </Button>
        </div>
      </div>
    </div>
  );
}
