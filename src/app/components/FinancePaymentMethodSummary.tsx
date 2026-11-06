import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { formatRupiah } from "../utils/financeFormatters";
import { usePaymentMethods } from "../data/paymentMethodStore";
import { Filter, Calendar, RotateCcw, Wallet, CreditCard, Building2, Banknote } from "lucide-react";

export function parseDateString(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr === "-" || dateStr === "null") return null;
  // If ISO "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  // Indonesian month strings e.g. "20 Agustus 2025" or "20/08/2025"
  const indonesianMonths: Record<string, number> = {
    januari: 0, jan: 0,
    februari: 1, feb: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, ags: 7, agu: 7,
    september: 8, sep: 8,
    oktober: 9, okt: 9,
    november: 10, nov: 10,
    desember: 11, des: 11,
  };
  const parts = dateStr.trim().split(/[\s-]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthKey = parts[1].toLowerCase();
    const month = indonesianMonths[monthKey];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function matchesDateRange(dateStr: string | undefined, start: string, end: string): boolean {
  if (!start && !end) return true;
  if (!dateStr || dateStr === "-") return false;
  const d = parseDateString(dateStr);
  if (!d) return true;
  if (start) {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    if (d < s) return false;
  }
  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    if (d > e) return false;
  }
  return true;
}

export function normalizePaymentCategory(methodOrBank: string | undefined): string {
  if (!methodOrBank) return "Transfer BCA";
  const s = methodOrBank.toLowerCase();
  if (s.includes("cash") || s.includes("tunai")) return "Cash";
  if (s.includes("qris")) return "QRIS";
  if (s.includes("bca")) return "Transfer BCA";
  if (s.includes("bri")) return "Transfer BRI";
  if (s.includes("mandiri")) return "Transfer Mandiri";
  if (s.includes("cimb")) return "Transfer CIMB";
  if (s.includes("bni")) return "Transfer BNI";
  return methodOrBank.startsWith("Transfer") ? methodOrBank : `Transfer ${methodOrBank}`;
}

export function matchesPaymentMethodFilter(item: any, filterVal: string): boolean {
  if (!filterVal || filterVal === "ALL") return true;
  const cat = normalizePaymentCategory(item.metodePembayaran || item.rekening || item.bank);
  const filterCat = normalizePaymentCategory(filterVal);
  if (cat === filterCat) return true;
  const raw = `${item.metodePembayaran || ""} ${item.rekening || ""} ${item.bank || ""}`.toLowerCase();
  return raw.includes(filterVal.toLowerCase());
}

interface PaymentFilterBarProps {
  selectedMethod: string;
  onMethodChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  selectedStatus?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: { value: string; label: string }[];
  statusLabel?: string;
  onReset: () => void;
}

export function PaymentFilterBar({
  selectedMethod,
  onMethodChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  selectedStatus,
  onStatusChange,
  statusOptions,
  statusLabel = "Status Pengerjaan",
  onReset,
}: PaymentFilterBarProps) {
  const { activePaymentMethods, activeMethods } = usePaymentMethods();
  const paymentMethodsList = activePaymentMethods || activeMethods || [];

  const isFiltered = selectedMethod !== "ALL" || startDate !== "" || endDate !== "" || (selectedStatus && selectedStatus !== "ALL");

  return (
    <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-2xs">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Filter Rekening & Periode Kas Masuk
            </h4>
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filter
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Metode / Rekening Pembayaran */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              Metode Pembayaran
            </label>
            <Select value={selectedMethod} onValueChange={onMethodChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih metode pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Metode Pembayaran</SelectItem>
                {paymentMethodsList.map((pm) => (
                  <SelectItem key={pm.id} value={pm.nama_metode}>
                    {pm.bank && pm.bank !== "Tunai" && pm.nomor_rekening
                      ? `${pm.nama_metode} (${pm.bank} - ${pm.nomor_rekening})`
                      : pm.nama_metode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Tanggal Mulai */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Tanggal Mulai
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* 3. Tanggal Selesai */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Tanggal Selesai
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* 4. Status (Optional) */}
          {statusOptions && onStatusChange && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                {statusLabel}
              </label>
              <Select value={selectedStatus || "ALL"} onValueChange={onStatusChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={`Pilih ${statusLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface InflowSummaryCardProps {
  items: any[];
  selectedMethod?: string;
  title?: string;
}

export function InflowSummaryCard({
  items,
  selectedMethod,
  title = "Ringkasan Arus Kas Masuk per Rekening / Metode Pembayaran",
}: InflowSummaryCardProps) {
  // Aggregate verified received money
  const summaryMap: Record<
    string,
    {
      method: string;
      rekening: string;
      bank: string;
      count: number;
      totalUangMasuk: number;
    }
  > = {};

  items.forEach((item) => {
    // 1. If item has payment history with split/multiple payments
    if (Array.isArray(item.riwayatPembayaran) && item.riwayatPembayaran.length > 0) {
      item.riwayatPembayaran.forEach((p: any) => {
        const nominal = Number(p.nominal || p.jumlah || 0);
        if (nominal <= 0) return;
        const cat = normalizePaymentCategory(p.metode || p.metodePembayaran || item.metodePembayaran || item.rekening);
        const isCash = cat === "Cash";
        const rekDisplay = isCash
          ? "—"
          : (p.noRekening || item.noRekening ? `${p.noRekening || item.noRekening}${p.namaRekening || item.namaRekening ? ` (${p.namaRekening || item.namaRekening})` : ""}` : (p.bank || item.bank || item.rekening || "Rekening Bank"));

        if (!summaryMap[cat]) {
          summaryMap[cat] = {
            method: cat,
            rekening: rekDisplay,
            bank: p.bank || item.bank || item.rekening || cat,
            count: 0,
            totalUangMasuk: 0,
          };
        }
        summaryMap[cat].count += 1;
        summaryMap[cat].totalUangMasuk += nominal;
      });
      return;
    }

    // 2. Standard single verified payment
    const masuk = Number(item.totalUangMasuk || item.uangMasuk || 0);
    if (masuk <= 0) return; // Strictly verified cash inflow only

    const cat = normalizePaymentCategory(item.metodePembayaran || item.rekening || item.bank);
    const isCash = cat === "Cash";
    const rekDisplay = isCash
      ? "—"
      : (item.noRekening
          ? `${item.noRekening}${item.namaRekening ? ` (${item.namaRekening})` : ""}`
          : (item.bank || item.rekening || "Rekening Bank"));

    if (!summaryMap[cat]) {
      summaryMap[cat] = {
        method: cat,
        rekening: rekDisplay,
        bank: item.bank || item.rekening || cat,
        count: 0,
        totalUangMasuk: 0,
      };
    }
    summaryMap[cat].count += 1;
    summaryMap[cat].totalUangMasuk += masuk;
  });

  const summaryRows = Object.values(summaryMap);
  const totalCount = summaryRows.reduce((acc, row) => acc + row.count, 0);
  const totalAmount = summaryRows.reduce((acc, row) => acc + row.totalUangMasuk, 0);

  return (
    <Card className="p-4 border border-border bg-card shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {title}
              {selectedMethod && selectedMethod !== "ALL" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                  Filter: {selectedMethod}
                </span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              Total penerimaan uang masuk terverifikasi berdasarkan rekening dan metode pembayaran aktual
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/15">
          <span className="text-[11px] text-muted-foreground block font-medium">Total Uang Masuk Terfilter:</span>
          <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatRupiah(totalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/20">
              <th className="py-2.5 px-3">Metode Pembayaran</th>
              <th className="py-2.5 px-3">Rekening Penerima</th>
              <th className="py-2.5 px-3 text-center">Jumlah Transaksi</th>
              <th className="py-2.5 px-3 text-right">Total Uang Masuk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                  Tidak ada transaksi dengan arus kas masuk terverifikasi pada filter yang dipilih.
                </td>
              </tr>
            ) : (
              summaryRows.map((row) => (
                <tr key={row.method} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                    {row.method === "Cash" ? (
                      <Banknote className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-blue-500" />
                    )}
                    <span>{row.method}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                    {row.rekening}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-medium">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-secondary text-secondary-foreground font-semibold">
                      {row.count} Transaksi
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(row.totalUangMasuk)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summaryRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border font-bold bg-muted/30">
                <td className="py-2.5 px-3 text-foreground" colSpan={2}>
                  Total Keseluruhan Sesuai Filter
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-foreground">
                  {totalCount} Transaksi
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatRupiah(totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

export interface UnifiedProfitInflowSectionProps {
  items: any[];
  selectedMethod: string;
  onMethodChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  selectedStatus?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: { value: string; label: string }[];
  statusLabel?: string;
  onReset: () => void;
  title?: string;
}

export function UnifiedProfitInflowSection({
  items,
  selectedMethod,
  onMethodChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  selectedStatus,
  onStatusChange,
  statusOptions,
  statusLabel = "Pengurusan",
  onReset,
  title = "Ringkasan Pemasukan per Rekening / Metode Pembayaran",
}: UnifiedProfitInflowSectionProps) {
  const { activePaymentMethods, activeMethods } = usePaymentMethods();
  const paymentMethodsList = activePaymentMethods || activeMethods || [];

  const isFiltered = selectedMethod !== "ALL" || startDate !== "" || endDate !== "" || (selectedStatus && selectedStatus !== "ALL");

  // Aggregate verified received money
  const summaryMap: Record<
    string,
    {
      method: string;
      rekening: string;
      bank: string;
      count: number;
      totalUangMasuk: number;
    }
  > = {};

  items.forEach((item) => {
    // 1. If item has payment history with split/multiple payments
    if (Array.isArray(item.riwayatPembayaran) && item.riwayatPembayaran.length > 0) {
      item.riwayatPembayaran.forEach((p: any) => {
        const nominal = Number(p.nominal || p.jumlah || 0);
        if (nominal <= 0) return;
        const cat = normalizePaymentCategory(p.metode || p.metodePembayaran || item.metodePembayaran || item.rekening);
        const isCash = cat === "Cash";
        const rekDisplay = isCash
          ? "—"
          : (p.noRekening || item.noRekening ? `${p.noRekening || item.noRekening}${p.namaRekening || item.namaRekening ? ` (${p.namaRekening || item.namaRekening})` : ""}` : (p.bank || item.bank || item.rekening || "Rekening Bank"));

        if (!summaryMap[cat]) {
          summaryMap[cat] = {
            method: cat,
            rekening: rekDisplay,
            bank: p.bank || item.bank || item.rekening || cat,
            count: 0,
            totalUangMasuk: 0,
          };
        }
        summaryMap[cat].count += 1;
        summaryMap[cat].totalUangMasuk += nominal;
      });
      return;
    }

    // 2. Standard single verified payment
    const masuk = Number(item.totalUangMasuk || item.uangMasuk || 0);
    if (masuk <= 0) return; // Strictly verified cash inflow only

    const cat = normalizePaymentCategory(item.metodePembayaran || item.rekening || item.bank);
    const isCash = cat === "Cash";
    const rekDisplay = isCash
      ? "—"
      : (item.noRekening
          ? `${item.noRekening}${item.namaRekening ? ` (${item.namaRekening})` : ""}`
          : (item.bank || item.rekening || "Rekening Bank"));

    if (!summaryMap[cat]) {
      summaryMap[cat] = {
        method: cat,
        rekening: rekDisplay,
        bank: item.bank || item.rekening || cat,
        count: 0,
        totalUangMasuk: 0,
      };
    }
    summaryMap[cat].count += 1;
    summaryMap[cat].totalUangMasuk += masuk;
  });

  const summaryRows = Object.values(summaryMap);
  const totalCount = summaryRows.reduce((acc, row) => acc + row.count, 0);
  const totalAmount = summaryRows.reduce((acc, row) => acc + row.totalUangMasuk, 0);

  return (
    <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs space-y-3">
      {/* 1. Header Area: Judul, Deskripsi Singkat, & Total Uang Masuk Terfilter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {title}
              {selectedMethod && selectedMethod !== "ALL" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                  Metode: {selectedMethod}
                </span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              Total penerimaan kas masuk terverifikasi per rekening & metode bayar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          )}
          <div className="bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/15 text-left sm:text-right">
            <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">Total Uang Masuk Terfilter</span>
            <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatRupiah(totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Filter Area: Grid 4 Kolom Ramping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-0.5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
            Metode Pembayaran
          </label>
          <Select value={selectedMethod} onValueChange={onMethodChange}>
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="Semua Metode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Metode Pembayaran</SelectItem>
              {paymentMethodsList.map((pm) => (
                <SelectItem key={pm.id} value={pm.nama_metode}>
                  {pm.bank && pm.bank !== "Tunai" && pm.nomor_rekening
                    ? `${pm.nama_metode} (${pm.bank} - ${pm.nomor_rekening})`
                    : pm.nama_metode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Tanggal Mulai
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="h-8.5 text-xs bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Tanggal Selesai
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="h-8.5 text-xs bg-background"
          />
        </div>

        {statusOptions && onStatusChange && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              {statusLabel}
            </label>
            <Select value={selectedStatus || "ALL"} onValueChange={onStatusChange}>
              <SelectTrigger className="h-8.5 text-xs bg-background">
                <SelectValue placeholder={`Pilih ${statusLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 3. Data Area: Compact Summary Table */}
      <div className="overflow-x-auto pt-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/20">
              <th className="py-2.5 px-3">Metode Pembayaran</th>
              <th className="py-2.5 px-3">Rekening Penerima</th>
              <th className="py-2.5 px-3 text-center">Jumlah Transaksi</th>
              <th className="py-2.5 px-3 text-right">Total Uang Masuk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground italic text-xs">
                  Tidak ada transaksi kas masuk terverifikasi pada filter yang dipilih.
                </td>
              </tr>
            ) : (
              summaryRows.map((row) => (
                <tr key={row.method} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                    {row.method === "Cash" ? (
                      <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span>{row.method}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground text-xs">
                    {row.rekening}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-secondary text-secondary-foreground font-medium">
                      {row.count} Transaksi
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(row.totalUangMasuk)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summaryRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border font-bold bg-muted/30">
                <td className="py-2.5 px-3 text-foreground font-semibold" colSpan={2}>
                  Total Keseluruhan Sesuai Filter
                </td>
                <td className="py-2.5 px-3 text-center font-mono font-semibold text-foreground">
                  {totalCount} Transaksi
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatRupiah(totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
