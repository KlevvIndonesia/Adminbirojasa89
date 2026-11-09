/**
 * Permanent Erasure Confirmation Dialog
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Privacy & Permanent Erasure UI:
 * - Preflight blocker checks with real-time feedback
 * - Comprehensive target identity summary before confirmation
 * - Explicit confirmation requiring typing 'HAPUS PERMANEN'
 * - Clear distinction of operation status (COMPLETED vs DATABASE_COMPLETED)
 * - Safe fallback and error handling
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  FileText,
  DollarSign,
  RefreshCw,
  AlertCircle,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

interface PermanentErasureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string | null;
  targetName?: string;
  onErasureSuccess?: (result: any) => void;
}

export function PermanentErasureDialog({
  open,
  onOpenChange,
  targetId,
  targetName,
  onErasureSuccess,
}: PermanentErasureDialogProps) {
  const { preflightPermanentErasure, permanentErasure } = useKaryawanPengguna();

  const [isLoadingPreflight, setIsLoadingPreflight] = useState(false);
  const [preflightData, setPreflightData] = useState<any>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [erasureReason, setErasureReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erasureResult, setErasureResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset and run preflight when dialog opens with a valid targetId
  useEffect(() => {
    if (open && targetId) {
      setConfirmationInput("");
      setErasureReason("");
      setErasureResult(null);
      setErrorMessage(null);
      runPreflight(targetId);
    }
  }, [open, targetId]);

  const runPreflight = async (id: string) => {
    setIsLoadingPreflight(true);
    setErrorMessage(null);
    try {
      const res = await preflightPermanentErasure(id);
      setPreflightData(res);
      if (!res.allowed && res.blockers?.length > 0) {
        setErrorMessage("Target memiliki kewajiban aktif yang harus diselesaikan terlebih dahulu.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal melakukan preflight check.");
    } finally {
      setIsLoadingPreflight(false);
    }
  };

  const handleExecuteErasure = async () => {
    if (!targetId || confirmationInput.trim() !== "HAPUS PERMANEN") {
      toast.error("Ketik 'HAPUS PERMANEN' secara tepat untuk konfirmasi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await permanentErasure(targetId, "HAPUS PERMANEN", erasureReason);
      if (res.success) {
        setErasureResult(res);
        toast.success(res.message || "Penghapusan permanen berhasil dilakukan.");
        if (onErasureSuccess) {
          onErasureSuccess(res);
        }
      } else {
        setErrorMessage(res.error || "Penghapusan permanen gagal.");
        if (res.blockers && res.blockers.length > 0) {
          // Re-update preflight state to reflect newly detected blockers
          setPreflightData((prev: any) => ({
            ...prev,
            allowed: false,
            blockers: res.blockers,
          }));
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem saat penghapusan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const target = preflightData?.target || {};
  const isAllowed = preflightData?.allowed ?? false;
  const blockers = preflightData?.blockers || [];
  const summary = preflightData?.summary || {};

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-destructive/30">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle className="text-lg font-bold">
              Penghapusan Permanen (Permanent Erasure)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Penghapusan permanen menghapus data master karyawan, akun login, kredensial, dan aktivitas personal.
            Nilai transaksi finansial dan dokumen konsumen tetap dipertahankan utuh.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Target Summary Box */}
        <div className="p-3 border rounded-lg bg-muted/40 space-y-2 text-xs">
          <div className="font-semibold text-foreground flex items-center justify-between">
            <span>Ringkasan Identitas Target</span>
            {target.userStatus && (
              <Badge variant={target.userStatus === "Aktif" ? "default" : "secondary"} className="text-[10px] h-5">
                {target.userStatus}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Nama:</span> {target.employeeName || targetName || "-"}
            </div>
            <div>
              <span className="font-medium text-foreground">ID Karyawan:</span> {target.employeeId || targetId || "-"}
            </div>
            <div>
              <span className="font-medium text-foreground">Jabatan:</span> {target.employeeJabatan || target.userRole || "-"}
            </div>
            <div>
              <span className="font-medium text-foreground">Wilayah:</span> {target.wilayah || "-"}
            </div>
            <div>
              <span className="font-medium text-foreground">NIK KTP:</span> {target.employeeNik ? `${target.employeeNik.slice(0, 6)}******` : "-"}
            </div>
            <div>
              <span className="font-medium text-foreground">Email:</span> {target.userEmail || "-"}
            </div>
          </div>
        </div>

        {/* 2. Loading State */}
        {isLoadingPreflight && (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span>Memvalidasi kewajiban aktif dan foreign key dependencies...</span>
          </div>
        )}

        {/* 3. Result State (COMPLETED or DATABASE_COMPLETED) */}
        {!isLoadingPreflight && erasureResult && (
          <div className="space-y-4 py-2">
            <div
              className={`p-4 rounded-lg border ${
                erasureResult.status === "COMPLETED"
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {erasureResult.status === "COMPLETED" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm">
                    {erasureResult.status === "COMPLETED"
                      ? "Penghapusan Permanen Selesai (COMPLETED)"
                      : "Database Selesai — Pembersihan File Tertunda (DATABASE_COMPLETED)"}
                  </div>
                  <p>{erasureResult.message}</p>
                  {erasureResult.fileCleanupPending && (
                    <p className="text-[11px] opacity-90">
                      Seluruh identitas, kredensial, dan referensi database telah berhasil dihapus permanen. File fisik
                      pribadi yang terkunci telah dijadwalkan dalam antrean pembersihan retry otomatis.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Tutup</Button>
            </DialogFooter>
          </div>
        )}

        {/* 4. Preflight Blockers View */}
        {!isLoadingPreflight && !erasureResult && !isAllowed && blockers.length > 0 && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                <Ban className="w-4 h-4" />
                <span>Penghapusan Ditolak — Terdapat {blockers.length} Kewajiban Aktif</span>
              </div>
              <ul className="text-xs space-y-1.5 pl-5 list-disc text-red-800">
                {blockers.map((b: any, idx: number) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="font-semibold">[{b.code}]:</span> {b.message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-[11px] text-muted-foreground p-2 border rounded bg-muted/20">
              Selesaikan penugasan order aktif, tugas operasional kurir, seimbangkan saldo kas ke Rp 0, atau selesaikan
              reimbursement yang tertunda sebelum data karyawan/pengguna ini dapat dihapus permanen.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* 5. Allowed Confirmation Form */}
        {!isLoadingPreflight && !erasureResult && isAllowed && (
          <div className="space-y-4">
            {/* Impact Metrics Summary */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 border rounded bg-green-50/50 border-green-200 text-green-900">
                <div className="font-bold text-sm">{summary.financialTransactionsPreserved ?? 0}</div>
                <div className="text-[10px] text-green-700 font-medium">Transaksi Finansial Dipertahankan</div>
              </div>
              <div className="p-2 border rounded bg-red-50/50 border-red-200 text-red-900">
                <div className="font-bold text-sm">{summary.auditLogsToPurge ?? 0}</div>
                <div className="text-[10px] text-red-700 font-medium">Log Pribadi Akan Dihapus</div>
              </div>
              <div className="p-2 border rounded bg-blue-50/50 border-blue-200 text-blue-900">
                <div className="font-bold text-sm">{summary.auditLogsToAnonymize ?? 0}</div>
                <div className="text-[10px] text-blue-700 font-medium">Log Riwayat Dianonimkan</div>
              </div>
            </div>

            {/* Strict Warning Alert */}
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>PERINGATAN: Tindakan Ini Tidak Dapat Dibatalkan</span>
              </div>
              <p className="text-[11px] leading-relaxed text-destructive/90">
                Master data karyawan, akun pengguna, password hash, dan session token akan dimusnahkan secara permanen
                dari sistem. Seluruh data identitas pada mutasi kas, pengeluaran, dan order akan dianonimkan menjadi
                staf/kurir anonim.
              </p>
            </div>

            {/* Optional Reason Input */}
            <div className="space-y-1 text-xs">
              <label className="font-medium text-foreground">Alasan Penghapusan (Opsional):</label>
              <Input
                placeholder="Contoh: Permintaan privasi GDPR/PDP, Pemutusan hubungan kerja"
                value={erasureReason}
                onChange={(e) => setErasureReason(e.target.value)}
                disabled={isSubmitting}
                className="text-xs h-8"
              />
            </div>

            {/* Explicit Confirmation Input */}
            <div className="space-y-1 text-xs">
              <label className="font-medium text-foreground flex items-center justify-between">
                <span>
                  Ketik <strong className="text-destructive font-mono">HAPUS PERMANEN</strong> untuk konfirmasi:
                </span>
                {confirmationInput === "HAPUS PERMANEN" && (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Konfirmasi Cocok
                  </span>
                )}
              </label>
              <Input
                placeholder="HAPUS PERMANEN"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                disabled={isSubmitting}
                className="font-mono text-xs tracking-wider"
              />
            </div>

            {errorMessage && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleExecuteErasure}
                disabled={confirmationInput.trim() !== "HAPUS PERMANEN" || isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses Penghapusan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Permanen Data Karyawan</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
