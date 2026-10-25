import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Printer, Download, MessageCircle, FileCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LOGO_SUN89_BASE64 } from "../assets/logoSun89Base64";
import { formatRupiah, formatDateDDMMYYYY, angkaKeTerbilang } from "../utils/financeFormatters";

export interface KwitansiData {
  orderNo?: string;
  invoiceNo?: string;
  kwitansiNo?: string;
  customer?: string;
  namaPemilik?: string;
  nopol?: string;
  layanan?: string;
  samsat?: string;
  tanggal?: string;
  nominal?: number;
  totalTagihan?: number;
  totalDibayar?: number;
  sisaTagihan?: number;
  metodePembayaran?: string;
  catatan?: string;
  noHp?: string;
  kasirName?: string;
}

interface KwitansiA5DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: KwitansiData | any;
}

export function KwitansiA5Dialog({ open, onOpenChange, data }: KwitansiA5DialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const customer = data["Nama Customer"] || data.customer || "Pelanggan";
  const namaPemilik = data["Nama Pemilik (STNK/BPKB)"] || data["Nama"] || data.namaPemilik || customer;
  const nopol = data["Plat No"] || data.nopol || "-";
  const layanan = data["Jenis Pengurusan"] || data.layanan || data.jenisLayanan || "Pengurusan Dokumen Samsat";
  const rawTanggal = data.tanggalBayar || data.tanggal || data.createdAt || new Date().toISOString();
  const tanggalStr = formatDateDDMMYYYY(rawTanggal);

  const orderNo = data.orderNo || data["Nomor Order"] || data["No Order"] || `ORD-${data.id || "001"}`;
  const invoiceNo = data["No Invoice"] || data.invoice || data.invoiceNo || (orderNo ? `INV/${orderNo.replace(/^ORD-/, "")}` : "INV-001");
  const kwitansiNo = data.kwitansiNo || `KW/${orderNo.replace(/^ORD-/, "")}/${data.paymentId || "01"}`;

  const nominal = Number(data.nominal ?? data.amount ?? data.lunasAmount ?? 0);
  const totalTagihan = Number(data.totalTagihan ?? data["Total Tagihan Konsumen"] ?? (nominal + Number(data.sisaTagihan ?? 0)));
  const totalDibayar = Number(data.totalDibayar ?? data.dibayar ?? data["Uang Masuk dari Konsumen"] ?? nominal);
  const sisaTagihan = Number(data.sisaTagihan ?? data.kekurangan ?? data.sisa ?? Math.max(0, totalTagihan - totalDibayar));
  const isLunas = sisaTagihan <= 0;

  const metode = data.metodePembayaran || data.metode || data.paymentMethod || "Transfer BCA";
  const phone = data.nomorHP || data.noHp || data["No HP / WhatsApp"] || data.phone || "";
  const kasir = data.kasirName || data.kasir || "Kasir Keuangan";

  const handlePrint = () => {
    window.print();
    toast.success("Kwitansi siap dicetak!");
  };

  const handleDownload = () => {
    window.print();
    toast.info("Pilih 'Save as PDF' di dialog cetak browser untuk menyimpan PDF.");
  };

  const handleSendWhatsApp = () => {
    if (!phone || !phone.trim() || phone === "-") {
      toast.warning("Nomor WhatsApp konsumen tidak tersedia.");
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("8")) {
      cleanPhone = "62" + cleanPhone;
    }
    const messageText = `Halo Bpk/Ibu ${customer},\n\nTerima kasih, pembayaran pengurusan dokumen kendaraan Anda telah kami terima dengan rincian sbb:\n\n• *Nomor Kwitansi* : ${kwitansiNo}\n• *Nomor Order*    : ${orderNo}\n• *Nomor Polisi*   : ${String(nopol).toUpperCase()}\n• *Jenis Layanan*  : ${layanan}\n• *Setoran Diterima*: *${formatRupiah(nominal)}* (${metode})\n• *Total Masuk*    : ${formatRupiah(totalDibayar)}\n• *Sisa Tagihan*   : *${isLunas ? "LUNAS (Rp 0)" : formatRupiah(sisaTagihan)}*\n\nStatus Pembayaran: *${isLunas ? "LUNAS (100%)" : "KURANG BAYAR"}*\n\nSalam,\n*Biro Jasa SUN89*`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank");
    toast.success(`Membuka WhatsApp untuk mengirim kwitansi ke ${customer}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 bg-card text-card-foreground overflow-hidden">
        <DialogHeader className="print:hidden p-4 sm:p-5 pb-3 border-b border-border/70 sticky top-0 bg-card z-10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Kwitansi Tanda Terima Pembayaran Sah</span>
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground">{kwitansiNo}</span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Format kwitansi tanda terima resmi Biro Jasa SUN89
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Container on Screen */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30 flex justify-center">
          {/* Printable Sheet Container */}
          <div
            id="kwitansi-print-area"
            ref={printAreaRef}
            className="w-full max-w-[210mm] min-h-[148mm] bg-white text-slate-900 p-6 rounded-md shadow-md border border-slate-300 text-[11px] flex flex-col justify-between"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            {/* KWITANSI HEADER */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                <div className="flex items-center gap-3">
                  <img
                    src={LOGO_SUN89_BASE64}
                    alt="Logo Biro Jasa SUN89"
                    className="w-12 h-12 object-contain rounded"
                  />
                  <div>
                    <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                      BIRO JASA SUN89
                    </h1>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Jasa Pengurusan STNK, BPKB, & Dokumen Samsat
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Jl. Raya Sukahati No. 6 Cibinong • WA: 0812-3456-7890
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-slate-900 text-white px-2.5 py-1 rounded text-[11px] font-black tracking-wider uppercase">
                    KWITANSI PEMBAYARAN
                  </div>
                  <p className="text-[10px] font-mono text-slate-700 mt-1 font-bold">
                    No: {kwitansiNo}
                  </p>
                  <p className="text-[10px] text-slate-500">Tgl: {tanggalStr}</p>
                </div>
              </div>

              {/* KWITANSI CONTENT */}
              <div className="mt-4 space-y-2.5 text-xs text-slate-800">
                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Sudah Terima Dari</span>
                  <span className="font-bold text-slate-900 uppercase">: {customer}</span>
                </div>

                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Banyaknya Uang</span>
                  <div className="flex-1 bg-slate-100 p-2 rounded border border-slate-200 italic font-semibold text-slate-800">
                    # {angkaKeTerbilang(nominal)} #
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Untuk Pembayaran</span>
                  <span className="flex-1 text-slate-800 leading-relaxed">
                    : Pembayaran {isLunas ? "Pelunasan Penuh" : "Setoran / Cicilan"} pengurusan dokumen <b>{layanan}</b> kendaraan nomor polisi <b>{String(nopol).toUpperCase()}</b>.
                    <br />
                    <span className="text-[10px] text-slate-500 font-mono">
                      (No. Order: {orderNo} • Ref. Invoice: {invoiceNo} • Metode: {metode})
                    </span>
                  </span>
                </div>
              </div>

              {/* FINANCIAL BREAKDOWN RECAPITULATION */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="border-r border-slate-200 pr-2">
                    <p className="text-[9px] text-slate-500 uppercase font-semibold">Total Tagihan</p>
                    <p className="text-xs font-bold font-mono text-slate-800 mt-0.5">{formatRupiah(totalTagihan)}</p>
                  </div>
                  <div className="border-r border-slate-200 pr-2">
                    <p className="text-[9px] text-slate-500 uppercase font-semibold">Setoran Hari Ini</p>
                    <p className="text-xs font-bold font-mono text-emerald-600 mt-0.5">{formatRupiah(nominal)}</p>
                  </div>
                  <div className="border-r border-slate-200 pr-2">
                    <p className="text-[9px] text-slate-500 uppercase font-semibold">Total Terbayar</p>
                    <p className="text-xs font-bold font-mono text-blue-600 mt-0.5">{formatRupiah(totalDibayar)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-semibold">Sisa Tagihan</p>
                    <p className={`text-xs font-bold font-mono mt-0.5 ${isLunas ? "text-emerald-700 font-black" : "text-rose-600"}`}>
                      {isLunas ? "LUNAS (Rp 0)" : formatRupiah(sisaTagihan)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* KWITANSI FOOTER & SIGNATURES */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex items-end justify-between">
              {/* Stamp & Notice */}
              <div className="space-y-1">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border-2 font-black text-xs uppercase tracking-wider ${
                  isLunas 
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "border-amber-500 text-amber-700 bg-amber-50"
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isLunas ? "LUNAS RESMI" : "DITERIMA SEBAGIAN"}</span>
                </div>
                <p className="text-[8px] text-slate-400 italic">
                  * Pembayaran sah apabila disertai stempel resmi Biro Jasa SUN89.
                </p>
              </div>

              {/* Signatures */}
              <div className="flex items-center gap-10 text-center text-[10px]">
                <div className="w-28">
                  <p className="text-slate-500">Penyetor,</p>
                  <div className="h-12 flex items-end justify-center font-bold text-slate-800">
                    ( {customer.length > 15 ? customer.slice(0, 15) + "..." : customer} )
                  </div>
                </div>
                <div className="w-28">
                  <p className="text-slate-500">Kasir Penerima,</p>
                  <div className="h-12 flex items-end justify-center font-bold text-slate-900 border-b border-slate-400">
                    ( {kasir} )
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DIALOG ACTIONS FOOTER */}
        <div className="print:hidden p-3 sm:p-4 border-t border-border/70 flex flex-wrap items-center justify-between gap-2 bg-card shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Tutup
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              className="text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Kirim ke WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs gap-1.5 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kwitansi (A5)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
