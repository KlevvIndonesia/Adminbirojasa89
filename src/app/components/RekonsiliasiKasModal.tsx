/**
 * Berita Acara Rekonsiliasi & Tutup Kas Harian (A5 Print & Voucher)
 * Admin SUN89 — Biro Jasa Management System
 */

import React, { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Printer, FileCheck, CheckCircle2, AlertTriangle, ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { formatRupiah, formatDateDDMMYYYY, angkaKeTerbilang } from "../utils/financeFormatters";
import { printA5Document } from "../utils/printA5Iframe";
import { LOGO_SUN89_BASE64 } from "../assets/logoSun89Base64";

export interface KasTransactionItem {
  id?: number | string;
  tanggal: string;
  status: "Debit" | "Kredit" | string;
  kategori?: string;
  keterangan: string;
  debit: number;
  kredit: number;
  penanggungJawab?: string;
  orderNo?: string;
  invoiceNo?: string;
}

interface RekonsiliasiKasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kasTransactions: KasTransactionItem[];
  currentUser?: { nama?: string; role?: string } | null;
}

export function RekonsiliasiKasModal({
  open,
  onOpenChange,
  kasTransactions,
  currentUser,
}: RekonsiliasiKasModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [saldoAwal, setSaldoAwal] = useState<number>(0);
  const [kasFisik, setKasFisik] = useState<number>(0);
  const [catatan, setCatatan] = useState<string>("");
  const [kasirName, setKasirName] = useState<string>(currentUser?.nama || "Petugas Kasir");
  const [spvName, setSpvName] = useState<string>("Supervisor Operasional");

  // Filter transactions for selected date
  const filteredRows = useMemo(() => {
    return kasTransactions.filter((item) => {
      if (!item.tanggal) return false;
      // Support ISO string or DD/MM/YYYY or YYYY-MM-DD
      const rawDate = item.tanggal;
      if (rawDate.includes("T")) {
        return rawDate.split("T")[0] === selectedDate;
      }
      if (rawDate.includes("-")) {
        return rawDate === selectedDate;
      }
      // If DD/MM/YYYY
      const parts = rawDate.split("/");
      if (parts.length === 3) {
        const formatted = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        return formatted === selectedDate;
      }
      return true;
    });
  }, [kasTransactions, selectedDate]);

  const totalDebit = useMemo(() => {
    return filteredRows.reduce((acc, row) => acc + (Number(row.debit) || 0), 0);
  }, [filteredRows]);

  const totalKredit = useMemo(() => {
    return filteredRows.reduce((acc, row) => acc + (Number(row.kredit) || 0), 0);
  }, [filteredRows]);

  const saldoSistem = useMemo(() => {
    return saldoAwal + totalDebit - totalKredit;
  }, [saldoAwal, totalDebit, totalKredit]);

  const selisih = useMemo(() => {
    return kasFisik - saldoSistem;
  }, [kasFisik, saldoSistem]);

  const nomorBA = useMemo(() => {
    const cleanDate = selectedDate.replace(/-/g, "");
    return `BA-KAS/${cleanDate}/01`;
  }, [selectedDate]);

  const handlePrint = () => {
    printA5Document(printAreaRef.current, `BeritaAcara_${nomorBA.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border border-border shadow-2xl">
        <DialogHeader className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Berita Acara Rekonsiliasi Tutup Kas Harian
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Rekonsiliasi saldo kas kantor, pencatatan fisik brankas, dan serah terima shift kasir
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} className="gap-2 shadow-sm">
                <Printer className="w-4 h-4" />
                Cetak Dokumen (A5)
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Input Parameters Form */}
        <div className="p-6 bg-muted/10 border-b border-border grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Tanggal Tutup Kas</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 h-9 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Saldo Awal Hari Ini</Label>
            <Input
              type="number"
              min="0"
              value={saldoAwal || ""}
              placeholder="0"
              onChange={(e) => setSaldoAwal(Number(e.target.value) || 0)}
              className="mt-1 h-9 text-xs font-mono font-medium"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Kas Fisik di Brankas</Label>
            <Input
              type="number"
              min="0"
              value={kasFisik || ""}
              placeholder="0"
              onChange={(e) => setKasFisik(Number(e.target.value) || 0)}
              className="mt-1 h-9 text-xs font-mono font-medium"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Status Rekonsiliasi</Label>
            <div className="mt-1 h-9 flex items-center">
              {selisih === 0 ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 py-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Seimbang (Nihil)
                </Badge>
              ) : selisih < 0 ? (
                <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" /> Selisih Kurang ({formatRupiah(Math.abs(selisih))})
                </Badge>
              ) : (
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 px-3 py-1 text-xs">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Selisih Lebih ({formatRupiah(selisih)})
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Printable A5 Document Preview */}
        <div className="p-6 flex justify-center bg-zinc-100/70 dark:bg-zinc-950/40">
          <div
            ref={printAreaRef}
            id="print-rekonsiliasi-area"
            className="w-full max-w-[700px] bg-white text-zinc-900 shadow-md border border-zinc-200 rounded-lg p-6 font-sans print:shadow-none print:border-none print:p-0"
            style={{ minHeight: "520px" }}
          >
            {/* Header / Kop Surat */}
            <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={LOGO_SUN89_BASE64}
                  alt="SUN89 Logo"
                  className="w-14 h-14 object-contain"
                />
                <div>
                  <h1 className="text-lg font-black tracking-wider text-zinc-900 leading-tight">
                    BIRO JASA SUN89
                  </h1>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                    Layanan Pengurusan Dokumen & Pajak Kendaraan Bermotor
                  </p>
                  <p className="text-[9px] text-zinc-500">
                    Kawasan Niaga Samsat • Hotline: 0812-3456-7890 • Email: finance@sunbirojasa.com
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold bg-zinc-900 text-white rounded uppercase tracking-wider mb-1">
                  BERITA ACARA TUTUP KAS
                </span>
                <p className="text-xs font-mono font-bold text-zinc-800">{nomorBA}</p>
                <p className="text-[10px] text-zinc-500">{formatDateDDMMYYYY(selectedDate)}</p>
              </div>
            </div>

            {/* Rekap Saldo Kas */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50">
                <h3 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  Ringkasan Mutasi Harian
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Saldo Kas Awal:</span>
                    <span className="font-mono font-semibold">{formatRupiah(saldoAwal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>(+) Total Pemasukan (Debit):</span>
                    <span className="font-mono font-semibold">{formatRupiah(totalDebit)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Total Pengeluaran (Kredit):</span>
                    <span className="font-mono font-semibold">{formatRupiah(totalKredit)}</span>
                  </div>
                  <div className="border-t border-zinc-300 pt-1 flex justify-between font-bold text-zinc-900">
                    <span>Saldo Akhir Sistem:</span>
                    <span className="font-mono text-sm">{formatRupiah(saldoSistem)}</span>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50">
                <h3 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  Hasil Rekonsiliasi Fisik
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Fisik Kas di Brankas:</span>
                    <span className="font-mono font-bold text-zinc-900">{formatRupiah(kasFisik)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Saldo Menurut Sistem:</span>
                    <span className="font-mono font-semibold">{formatRupiah(saldoSistem)}</span>
                  </div>
                  <div className="border-t border-zinc-300 pt-1 flex justify-between font-bold">
                    <span>Status Selisih Fisik:</span>
                    <span
                      className={`font-mono text-sm ${
                        selisih === 0
                          ? "text-emerald-700"
                          : selisih < 0
                          ? "text-rose-700"
                          : "text-blue-700"
                      }`}
                    >
                      {selisih === 0
                        ? "NIHIL (SEIMBANG)"
                        : selisih < 0
                        ? `- ${formatRupiah(Math.abs(selisih))}`
                        : `+ ${formatRupiah(selisih)}`}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 italic mt-1">
                    * Terbilang fisik: {angkaKeTerbilang(kasFisik)} rupiah.
                  </p>
                </div>
              </div>
            </div>

            {/* Rincian Transaksi Singkat */}
            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Daftar Transaksi Kas Hari Ini ({filteredRows.length} Transaksi)
              </h3>
              <div className="border border-zinc-200 rounded overflow-hidden">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-zinc-100 text-zinc-700 border-b border-zinc-200 uppercase font-semibold">
                    <tr>
                      <th className="p-1.5">Keterangan</th>
                      <th className="p-1.5">Penanggung Jawab</th>
                      <th className="p-1.5 text-right">Debit (Masuk)</th>
                      <th className="p-1.5 text-right">Kredit (Keluar)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredRows.slice(0, 6).map((r, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="p-1.5 truncate max-w-[240px]">{r.keterangan || "-"}</td>
                        <td className="p-1.5 text-zinc-600">{r.penanggungJawab || "-"}</td>
                        <td className="p-1.5 text-right font-mono text-emerald-700">
                          {r.debit > 0 ? formatRupiah(r.debit) : "-"}
                        </td>
                        <td className="p-1.5 text-right font-mono text-rose-700">
                          {r.kredit > 0 ? formatRupiah(r.kredit) : "-"}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length > 6 && (
                      <tr>
                        <td colSpan={4} className="p-1 text-center text-zinc-500 italic text-[9px]">
                          ... dan {filteredRows.length - 6} transaksi lainnya tercatat di sistem kas kantor ...
                        </td>
                      </tr>
                    )}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-2 text-center text-zinc-400 italic">
                          Tidak ada mutasi kas untuk tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kolom Tanda Tangan Dual Control */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-zinc-200 text-center text-xs">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                  Diserahkan Oleh (Kasir / Petugas Finance):
                </p>
                <div className="h-14 flex items-end justify-center">
                  <span className="font-bold underline text-zinc-800">{kasirName}</span>
                </div>
                <p className="text-[9px] text-zinc-400">Petugas Kasir Bertugas</p>
              </div>

              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                  Diperiksa & Disetujui Oleh:
                </p>
                <div className="h-14 flex items-end justify-center">
                  <span className="font-bold underline text-zinc-800">{spvName}</span>
                </div>
                <p className="text-[9px] text-zinc-400">Supervisor / Finance Manager</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
