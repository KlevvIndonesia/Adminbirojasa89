import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  FileText,
  Camera,
  Layers,
  ArrowRight,
  Eye,
  MessageSquare,
} from "lucide-react";
import { DocumentPreviewModal } from "../DocumentPreviewModal";
import {
  ReimbursementCategory,
  ReimbursementStatus,
  UserContext,
  getMessengerTasksForEmployee,
} from "../../data/messengerTaskAdapter";
import { useFinanceStore } from "../../data/financeStore";
import { useOrderStore } from "../../data/orderStore";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerReimbursementViewProps {
  currentUser: UserContext;
}

const REIMBURSEMENT_CATEGORIES: ReimbursementCategory[] = [
  "Bensin",
  "Parkir",
  "Tol",
  "Transportasi",
  "Biaya Operasional Lainnya",
];

type FilterStatus = "ALL" | ReimbursementStatus;

export function MessengerReimbursementView({ currentUser }: MessengerReimbursementViewProps) {
  const { reimbursements, submitReimbursement, refreshReimbursements } = useFinanceStore();
  const { activeOrders } = useOrderStore();

  useEffect(() => {
    refreshReimbursements();
  }, [refreshReimbursements]);

  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("ALL");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Hidden real file input for receipt photo
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [category, setCategory] = useState<ReimbursementCategory>("Bensin");
  const [amountStr, setAmountStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>("none");
  const [note, setNote] = useState<string>("");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);

  // Messenger active tasks to link to reimbursement
  const myTasks = useMemo(() => {
    return getMessengerTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  // Strictly filter reimbursements for current messenger by employee ID or name
  const myReimbursements = useMemo(() => {
    const curEmpId = (currentUser.employeeId || "").toLowerCase().trim();
    const curName = (currentUser.userName || "").toLowerCase().trim();
    return reimbursements.filter((r) => {
      const matchId = curEmpId && r.employeeId?.toLowerCase().trim() === curEmpId;
      const matchName = curName && r.messengerName?.toLowerCase().trim() === curName;
      return matchId || matchName;
    });
  }, [reimbursements, currentUser.employeeId, currentUser.userName]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalNominal = 0;
    let pendingCount = 0;
    let pendingNominal = 0;
    let approvedCount = 0;
    let approvedNominal = 0;
    let paidCount = 0;
    let paidNominal = 0;

    myReimbursements.forEach((r) => {
      totalNominal += r.amount;
      if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
        pendingCount += 1;
        pendingNominal += r.amount;
      } else if (r.status === "Disetujui") {
        approvedCount += 1;
        approvedNominal += r.amount;
      } else if (r.status === "Dibayar") {
        paidCount += 1;
        paidNominal += r.amount;
      }
    });

    return {
      totalNominal,
      pendingCount,
      pendingNominal,
      approvedCount,
      approvedNominal,
      paidCount,
      paidNominal,
    };
  }, [myReimbursements]);

  // Filtered List
  const filteredList = useMemo(() => {
    if (selectedFilter === "ALL") return myReimbursements;
    return myReimbursements.filter((r) => r.status === selectedFilter);
  }, [myReimbursements, selectedFilter]);

  // Real receipt photo upload handler
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setReceiptUrl(result);
        toast.success(`Foto struk ${file.name} berhasil dilampirkan!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amountStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast.error("Nominal pengajuan biaya harus lebih dari 0!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitReimbursement({
        employeeId: currentUser.employeeId || "EMP-MSG-001",
        messengerName: currentUser.userName,
        category,
        amount: cleanAmount,
        date: dateStr,
        orderNo: selectedOrderNo !== "none" ? selectedOrderNo : undefined,
        note: note.trim() || undefined,
        receiptUrl: receiptUrl || undefined,
        receiptName: receiptUrl ? "kuitansi.jpg" : undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal mengirim pengajuan biaya ke server.");
        return;
      }

      toast.success(
        `Pengajuan ${category} sebesar Rp ${cleanAmount.toLocaleString("id-ID")} berhasil diverifikasi dan disimpan ke server!`
      );
      setIsSubmitModalOpen(false);
      // Reset form
      setCategory("Bensin");
      setAmountStr("");
      setSelectedOrderNo("none");
      setNote("");
      setReceiptUrl("");
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim pengajuan biaya");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReimbursementStatus) => {
    switch (status) {
      case "Diajukan":
        return <Badge variant="outline" className="text-xs font-semibold bg-blue-500/10 text-blue-600 border-blue-200">Diajukan</Badge>;
      case "Sedang Ditinjau":
        return <Badge variant="outline" className="text-xs font-semibold bg-amber-500/10 text-amber-600 border-amber-200">Ditinjau</Badge>;
      case "Disetujui":
        return <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-200">Disetujui</Badge>;
      case "Dibayar":
        return <Badge variant="outline" className="text-xs font-semibold bg-purple-500/10 text-purple-600 border-purple-200">Dibayar</Badge>;
      case "Ditolak":
        return <Badge variant="outline" className="text-xs font-semibold bg-rose-500/10 text-rose-600 border-rose-200">Ditolak</Badge>;
    }
  };

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
      {/* Top Banner & Quick Action */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Pengajuan Biaya Operasional
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
            Ajukan penggantian dana operasional (bensin, tol, parkir, dll.) langsung ke tim Finance.
          </p>
        </div>

        <Button
          onClick={() => setIsSubmitModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm min-h-[44px] px-5 rounded-xl shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" /> Ajukan Biaya
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Total Diajukan
          </span>
          <p className="text-base sm:text-lg font-bold text-foreground mt-1 truncate">
            Rp {kpis.totalNominal.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {myReimbursements.length} pengajuan
          </span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/15 dark:bg-amber-950/10 shadow-2xs">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
            Menunggu Review
          </span>
          <p className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300 mt-1 truncate">
            Rp {kpis.pendingNominal.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-amber-600/80 dark:text-amber-400 mt-0.5 block">
            {kpis.pendingCount} pending
          </span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/15 dark:bg-blue-950/10 shadow-2xs">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
            Disetujui
          </span>
          <p className="text-base sm:text-lg font-bold text-blue-800 dark:text-blue-300 mt-1 truncate">
            Rp {kpis.approvedNominal.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-blue-600/80 dark:text-blue-400 mt-0.5 block">
            {kpis.approvedCount} siap cair
          </span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/15 dark:bg-emerald-950/10 shadow-2xs">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Telah Dibayar
          </span>
          <p className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1 truncate">
            Rp {kpis.paidNominal.toLocaleString("id-ID")}
          </p>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400 mt-0.5 block">
            {kpis.paidCount} cair
          </span>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedFilter("ALL")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedFilter === "ALL"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Semua ({myReimbursements.length})
        </button>

        <button
          onClick={() => setSelectedFilter("Diajukan")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedFilter === "Diajukan"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Diajukan
        </button>

        <button
          onClick={() => setSelectedFilter("Disetujui")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedFilter === "Disetujui"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Disetujui
        </button>

        <button
          onClick={() => setSelectedFilter("Dibayar")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedFilter === "Dibayar"
              ? "bg-purple-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Dibayar
        </button>

        <button
          onClick={() => setSelectedFilter("Ditolak")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedFilter === "Ditolak"
              ? "bg-rose-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Ditolak
        </button>
      </div>

      {/* Reimbursement Submissions List */}
      {filteredList.length > 0 ? (
        <div className="space-y-3">
          {filteredList.map((req) => (
            <Card
              key={req.id}
              className="p-4 rounded-2xl border bg-card space-y-3 shadow-2xs"
            >
              {/* Header: ID, Category, Status, Nominal */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border/60">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {req.id}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {req.category}
                    </Badge>
                    {req.orderNo && (
                      <Badge variant="outline" className="text-xs bg-muted font-mono font-semibold">
                        {req.orderNo}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Tanggal Pengeluaran: {req.date}
                  </span>
                </div>

                <div className="text-right">
                  {req.approvedAmount !== undefined && req.status !== "Diajukan" ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Diajukan: <span className="line-through">Rp {req.amount.toLocaleString("id-ID")}</span>
                      </div>
                      <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 block">
                        Rp {req.approvedAmount.toLocaleString("id-ID")}
                      </span>
                      {req.approvedAmount < req.amount && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">
                          Disetujui sebagian
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-base sm:text-lg font-bold text-foreground">
                      Rp {req.amount.toLocaleString("id-ID")}
                    </span>
                  )}
                  <div className="mt-1">{getStatusBadge(req.status)}</div>
                </div>
              </div>

              {/* Note / Details */}
              {req.note && (
                <p className="text-sm text-foreground/90 bg-muted/40 p-2.5 rounded-xl leading-relaxed">
                  {req.note}
                </p>
              )}

              {/* Admin Review Notes (if provided by finance) */}
              {req.reviewNotes && (
                <div className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl space-y-1">
                  <span className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Catatan Tim Finance / Admin:
                  </span>
                  <p className="leading-relaxed">{req.reviewNotes}</p>
                </div>
              )}

              {/* Receipt / Proof Thumbnail (Clickable to preview) */}
              {req.receiptUrl && (
                <div
                  onClick={() => setPreviewDoc({ url: req.receiptUrl!, title: `Bukti Kuitansi ${req.id} - ${req.category}` })}
                  className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold p-1 hover:bg-emerald-500/5 rounded-lg cursor-pointer transition-colors w-fit"
                  title="Klik untuk memperbesar bukti kuitansi"
                >
                  <img
                    src={req.receiptUrl}
                    alt="Bukti kuitansi"
                    className="w-10 h-10 object-cover rounded-lg border border-border shadow-2xs"
                  />
                  <div className="flex items-center gap-1">
                    <span>Bukti kuitansi / struk terlampir</span>
                    <Eye className="w-3.5 h-3.5 opacity-70" />
                  </div>
                </div>
              )}

              {/* Audit Trail Note */}
              <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-1">
                <span>Diajukan: {new Date(req.submittedAt).toLocaleDateString("id-ID")}</span>
                {req.reviewedBy && (
                  <span>Ditinjau oleh: {req.reviewedBy}</span>
                )}
                {req.paidAt && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Dicairkan pada {new Date(req.paidAt).toLocaleDateString("id-ID")}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed bg-card/50 rounded-2xl">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h3 className="text-sm sm:text-base font-semibold text-foreground">Tidak Ada Pengajuan</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Belum ada riwayat pengajuan biaya untuk status yang dipilih.
          </p>
        </Card>
      )}

      {/* Modal: Ajukan Biaya */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-md w-full p-4 sm:p-5 gap-3.5 text-left">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Ajukan Biaya Operasional
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Isi formulir pengajuan biaya operasional messenger dan lampirkan kuitansi atau struk bukti.
            </DialogDescription>
          </DialogHeader>

          {/* Hidden Real File Input */}
          <input
            ref={receiptFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReceiptFileChange}
          />

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Jenis Biaya Operasional</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as ReimbursementCategory)}>
                <SelectTrigger className="w-full min-h-[44px] text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REIMBURSEMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-sm">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nominal */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Nominal (Rupiah) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="text"
                  placeholder="50.000"
                  value={amountStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setAmountStr(isNaN(num) ? "" : num.toLocaleString("id-ID"));
                  }}
                  className="pl-11 min-h-[44px] text-base font-semibold"
                  required
                />
              </div>
            </div>

            {/* Tanggal & Order Terkait */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Tanggal Pengeluaran</Label>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="min-h-[44px] text-base"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Order Terkait (Opsional)</Label>
                <Select value={selectedOrderNo} onValueChange={setSelectedOrderNo}>
                  <SelectTrigger className="w-full min-h-[44px] text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-sm">
                      Tidak Terkait Order
                    </SelectItem>
                    {myTasks.map((t) => (
                      <SelectItem key={t.orderNo} value={t.orderNo} className="text-sm">
                        {t.orderNo} ({t.nopol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Catatan */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Catatan / Keterangan</Label>
              <Textarea
                placeholder="Contoh: Bensin motor operasional ke Samsat Cibinong PP..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-base min-h-[60px] resize-none"
              />
            </div>

            {/* Bukti Foto Kuitansi */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Foto Struk / Kuitansi (Opsional)</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => receiptFileInputRef.current?.click()}
                  className="min-h-[44px] text-sm px-4 rounded-xl"
                >
                  <Camera className="w-4 h-4 mr-2 text-primary" />
                  {receiptUrl ? "Ganti Foto Struk" : "Ambil Foto Struk / Unggah"}
                </Button>
                {receiptUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={receiptUrl}
                      alt="Struk kuitansi"
                      className="w-10 h-10 object-cover rounded-lg border border-border"
                    />
                    <span className="text-xs text-emerald-600 font-semibold">
                      ✓ Foto terlampir
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <DialogFooter className="pt-2 flex gap-2 justify-end border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitModalOpen(false)}
                className="min-h-[44px] text-sm"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm min-h-[44px] px-5"
              >
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full preview modal for receipt photos */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || "Pratinjau Kuitansi"}
        documentName="Foto Kuitansi / Struk Biaya"
        rawUrl={previewDoc?.url}
        fileType="image"
      />
    </div>
  );
}
