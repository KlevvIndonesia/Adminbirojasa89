import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Printer, Download, CheckCircle2, ShieldAlert, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { LOGO_SUN89_BASE64 } from "../assets/logoSun89Base64";
import { formatRupiah, formatDateDDMMYYYY } from "../utils/financeFormatters";
import { printA5Document } from "../utils/printA5Iframe";
import { copyElementAsImageToClipboard, downloadElementAsImage } from "../utils/clipboardImage";

export interface InvoiceA5Data {
  orderNo?: string;
  invoiceNo?: string;
  customer?: string;
  namaPemilik?: string;
  nopol?: string;
  layanan?: string;
  samsat?: string;
  tanggal?: string;
  totalBiaya?: number;
  dibayar?: number;
  kurang?: number;
  biayaJasa?: number;
  pkb?: number;
  swdkllj?: number;
  opsenPkb?: number;
  pnbp?: number;
  statusPembayaran?: string;
  metodePembayaran?: string;
  noHp?: string;
  alamat?: string;
}

interface InvoiceA5DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
}

export function InvoiceA5Dialog({ open, onOpenChange, data }: InvoiceA5DialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  if (!data) return null;

  // Normalize incoming fields
  const customer = data["Nama Customer"] || data.customer || "Pelanggan Umum";
  const namaPemilik = data["Nama Pemilik (STNK/BPKB)"] || data["Nama"] || data.namaPemilik || customer;
  const nopol = data["Plat No"] || data.nopol || "-";
  const layanan = data["Jenis Pengurusan"] || data.layanan || data.jenisLayanan || "Pengurusan Samsat";
  const samsat = data["Samsat Asal"] || data["Samsat"] || data.wilayahSamsatAsal || data.samsat || "Samsat DKI Jakarta";
  
  const rawTanggal = data["Tanggal Masuk Berkas"] || data.tanggal || data.createdAt || new Date().toISOString();
  const tanggalStr = formatDateDDMMYYYY(rawTanggal);

  const orderNo = data.orderNo || data["Nomor Order"] || data["No Order"] || (typeof data.id === "string" && data.id.startsWith("ord:") ? data.id.slice(4) : (data["No Invoice"] || `ORD-${data.id || "001"}`));
  const invoiceNo = data["No Invoice"] || data.invoice || data.invoiceNo || (orderNo ? `INV/${orderNo.replace(/^ORD-/, "")}` : "INV-001");

  // Financial figures
  const uangMasuk = typeof data["Uang Masuk dari Konsumen"] === "number" 
    ? data["Uang Masuk dari Konsumen"] 
    : (data.dibayar ?? data.terbayar ?? 0);

  const sisa = typeof data["Sisa Tagihan"] === "number"
    ? data["Sisa Tagihan"]
    : typeof data.Kekurangan === "number"
    ? data.Kekurangan
    : (data.sisaTagihan ?? data.sisa ?? data.kurang ?? 0);

  const total = (typeof data["Total Tagihan Konsumen"] === "number" && data["Total Tagihan Konsumen"] > 0)
    ? data["Total Tagihan Konsumen"]
    : (typeof data.totalBiaya === "number" && data.totalBiaya > 0)
    ? data.totalBiaya
    : (typeof data.totalTagihan === "number" && data.totalTagihan > 0)
    ? data.totalTagihan
    : (uangMasuk + sisa > 0 ? uangMasuk + sisa : 150000);

  const dibayar = uangMasuk;
  const kurang = sisa > 0 ? sisa : Math.max(0, total - dibayar);
  const isLunas = kurang <= 0;

  // Breakdown items
  const biayaJasa = data["Biaya Jasa"] || data.biayaJasa || Math.round(total * 0.25) || 150000;
  const swdkllj = data.swdkllj || (total > 300000 ? 143000 : 35000);
  const pkb = data["Biaya Pokok Samsat"] || data.pkb || Math.max(0, total - biayaJasa - swdkllj);

  const phone = data.nomorHP || data.noHp || data["No HP / WhatsApp"] || data.phone || "";

  // Format nama file: nomor order - nama customer - plat nomor polisi
  const cleanOrder = String(orderNo || "ORD").trim().replace(/[/\\?%*:|"<>]/g, "-");
  const cleanCustomer = String(customer || "Customer").trim().replace(/[/\\?%*:|"<>]/g, "-");
  const cleanNopol = String(nopol || "").trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, "-");
  const pdfFileName = `${cleanOrder} - ${cleanCustomer} - ${cleanNopol}`;

  const handlePrint = () => {
    printA5Document(printAreaRef.current, pdfFileName);
    toast.success("Faktur invoice A5 siap dicetak!");
  };

  const handleDownload = () => {
    printA5Document(printAreaRef.current, pdfFileName);
    toast.info("Pilih 'Save as PDF' / 'Simpan sebagai PDF' di jendela cetak (nama file terisi otomatis).");
  };

  const handleCopyImage = async () => {
    if (!printAreaRef.current) return;
    try {
      setIsCopyingImage(true);
      const ok = await copyElementAsImageToClipboard(printAreaRef.current);
      if (ok) {
        toast.success("Gambar faktur berhasil disalin ke clipboard! Silakan tekan Ctrl + V di WhatsApp atau aplikasi lain untuk menempelkan gambar.", {
          duration: 6000,
        });
      } else {
        await downloadElementAsImage(printAreaRef.current, pdfFileName);
        toast.info("Gambar faktur diunduh sebagai file PNG (Clipboard browser tidak diizinkan).");
      }
    } catch (err) {
      console.error("Gagal menyalin gambar faktur:", err);
      toast.error("Gagal menyalin gambar faktur. Mengunduh file PNG...");
      await downloadElementAsImage(printAreaRef.current, pdfFileName);
    } finally {
      setIsCopyingImage(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phone || !phone.trim() || phone === "-") {
      toast.warning("Nomor WhatsApp konsumen tidak tersedia pada data transaksi ini.");
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("8")) {
      cleanPhone = "62" + cleanPhone;
    }

    // 1. Otomatis salin gambar faktur ke Clipboard (Opsi A)
    let imageCopied = false;
    if (printAreaRef.current) {
      try {
        setIsCopyingImage(true);
        imageCopied = await copyElementAsImageToClipboard(printAreaRef.current);
      } catch (err) {
        console.warn("[SUN89] Gagal auto-copy gambar ke clipboard:", err);
      } finally {
        setIsCopyingImage(false);
      }
    }

    // 2. Format pesan WhatsApp sesuai template resmi
    const messageText = `Halo ${customer},

kami dari Biro Jasa SUN89 menginformasikan tagihan pengurusan ${layanan} (No. Polisi: ${String(nopol).toUpperCase()}, Order: ${orderNo}) memiliki sisa tagihan sebesar ${formatRupiah(kurang)}.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Mohon konfirmasi jadwal pelunasan.
Terima kasih.
*(Faktur tagihan resmi terlampir)*`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank");

    if (imageCopied) {
      toast.success("Gambar faktur tersalin ke clipboard! Tekan Ctrl + V di chat WhatsApp untuk menempelkan gambar.", {
        duration: 8000,
      });
    } else {
      toast.info(`Membuka WhatsApp ke ${phone}. Silakan lampirkan faktur ke chat.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 bg-card text-card-foreground overflow-hidden">
        <DialogHeader className="print:hidden p-4 sm:p-5 pb-3 border-b border-border/70 sticky top-0 bg-card z-10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>Cetak Invoice Resmi A5</span>
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground">{invoiceNo}</span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Format faktur cetak standar A5 portrait resmi Biro Jasa SUN89
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Container on Screen */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30 flex justify-center">
          {/* Printable A5 Sheet Container */}
          <div
            id="invoice-a5-print-area"
            ref={printAreaRef}
            className="w-full max-w-[148mm] min-h-[195mm] bg-white text-slate-900 p-5 rounded-md shadow-md border border-slate-200 text-[11px] flex flex-col justify-between"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            {/* INVOICE HEADER */}
            <div>
              <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900 gap-4">
                {/* Logo & Company info - Stacked Vertically, Logo Enlarged, Header Text Removed */}
                <div className="flex flex-col items-start gap-1 max-w-[62%]">
                  <img
                    src={LOGO_SUN89_BASE64}
                    alt="Logo Biro Jasa SUN89"
                    className="h-12 w-auto object-contain object-left mb-0.5"
                  />
                  <p className="text-[9px] font-semibold text-slate-700 uppercase tracking-wide leading-tight">
                    Jasa Pengurusan Dokumen Samsat &amp; Kendaraan Bermotor
                  </p>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Jl. Raya Sukahati No. 6, Kel. Sukahati, Kec. Cibinong, Bogor
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono leading-tight">
                    Telp / WhatsApp: 0812-3456-7890 • 021-83715981
                  </p>
                </div>

                {/* Invoice Title & Meta - Single line per item, font sized to fit perfectly */}
                <div className="text-right shrink-0">
                  <span className="inline-block bg-slate-900 text-white font-bold text-xs uppercase px-2.5 py-0.5 rounded tracking-wider mb-2">
                    INVOICE
                  </span>
                  <div className="text-[9px] space-y-1 text-right">
                    <p className="whitespace-nowrap">
                      <span className="text-slate-500">Nomor Invoice: </span>
                      <strong className="font-mono text-slate-900">{invoiceNo}</strong>
                    </p>
                    <p className="whitespace-nowrap">
                      <span className="text-slate-500">Tanggal: </span>
                      <strong className="font-mono text-slate-900">{tanggalStr}</strong>
                    </p>
                    <p className="whitespace-nowrap">
                      <span className="text-slate-500">Nomor Order: </span>
                      <strong className="font-mono text-slate-900">{orderNo}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* CLIENT & VEHICLE INFORMATION CARD */}
              <div className="grid grid-cols-2 gap-2 my-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                <div>
                  <p className="text-slate-500 uppercase font-semibold text-[8px] tracking-wider mb-0.5">Informasi Customer</p>
                  <p className="font-bold text-slate-900 text-xs">{customer}</p>
                  <p className="text-slate-600">Pemilik STNK/BPKB: <strong className="text-slate-800">{namaPemilik}</strong></p>
                  {data.nomorHP && <p className="text-slate-600 font-mono">Kontak: {data.nomorHP}</p>}
                </div>
                <div className="text-right">
                  <p className="text-slate-500 uppercase font-semibold text-[8px] tracking-wider mb-0.5">Detail Kendaraan &amp; Layanan</p>
                  <div className="inline-block bg-slate-900 text-white font-mono font-bold text-xs px-2 py-0.5 rounded tracking-widest mb-1">
                    {nopol.toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-800">{layanan}</p>
                  <p className="text-slate-500">Wilayah: {samsat}</p>
                </div>
              </div>

              {/* ITEMIZATION TABLE */}
              <table className="w-full border-collapse my-2.5 text-[10px]">
                <thead>
                  <tr className="border-y border-slate-300 bg-slate-100 text-slate-700">
                    <th className="py-1.5 px-2 text-left font-semibold w-8">NO</th>
                    <th className="py-1.5 px-2 text-left font-semibold">URAIAN / RINCIAN BIAYA</th>
                    <th className="py-1.5 px-2 text-right font-semibold w-28">JUMLAH (RP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-1.5 px-2 text-center text-slate-500 font-mono">1</td>
                    <td className="py-1.5 px-2">
                      <span className="font-medium text-slate-900">Jasa Pengurusan Biro Jasa SUN89</span>
                      <span className="block text-[9px] text-slate-500">Pengurusan berkas Samsat ({layanan})</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium">{formatRupiah(biayaJasa)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-center text-slate-500 font-mono">2</td>
                    <td className="py-1.5 px-2">
                      <span className="font-medium text-slate-900">Pajak Kendaraan Bermotor (PKB Pokok + Opsen)</span>
                      <span className="block text-[9px] text-slate-500">Ketetapan Surat Pemberitahuan Pajak Daerah resmi</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium">{formatRupiah(pkb)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-center text-slate-500 font-mono">3</td>
                    <td className="py-1.5 px-2">
                      <span className="font-medium text-slate-900">SWDKLLJ / Jasa Raharja</span>
                      <span className="block text-[9px] text-slate-500">Sumbangan Wajib Dana Kecelakaan Lalu Lintas Jalan</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium">{formatRupiah(swdkllj)}</td>
                  </tr>
                </tbody>
              </table>

              {/* PAYMENT SUMMARY & STAMP */}
              <div className="flex justify-between items-start my-2.5 pt-1.5 gap-4">
                {/* Left Column: Official Bank Account Box */}
                <div className="w-[48%]">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[9.5px] space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-wide">
                      Rekening Resmi Pembayaran:
                    </p>
                    <div className="pl-0.5 space-y-0.5">
                      <p className="text-slate-800 font-mono font-bold text-[11px]">Bank BCA: 7175095764</p>
                      <p className="text-slate-700 font-medium">a/n ANISA SUSANTI</p>
                      <p className="text-slate-500 text-[8.5px] italic">Biro Jasa SUN89 Operasional</p>
                    </div>
                  </div>
                  <p className="text-[8.5px] text-slate-500 mt-1.5 pl-0.5 leading-relaxed">
                    * Harap cantumkan Nomor Order atau Nomor Invoice saat melakukan konfirmasi transfer.
                  </p>
                </div>

                {/* Right Column: Financial Figures + Status Stamp Underneath */}
                <div className="w-[52%]">
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600">Total Tagihan:</span>
                      <strong className="font-mono text-slate-900">{formatRupiah(total)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                      <span>Total Terbayar:</span>
                      <span className="font-mono font-bold">{formatRupiah(dibayar)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b-2 border-slate-900">
                      <span className="font-bold text-slate-900">Sisa Tagihan:</span>
                      <span className={`font-mono font-bold ${kurang > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatRupiah(kurang)}
                      </span>
                    </div>

                    {/* Status Badge Positioned Under Sisa Tagihan */}
                    <div className="pt-1.5">
                      <div className={`p-2 rounded border flex items-center justify-between gap-2 ${
                        isLunas 
                          ? "border-emerald-500/40 bg-emerald-50 text-emerald-800" 
                          : "border-amber-500/40 bg-amber-50 text-amber-800"
                      }`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isLunas ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[10.5px] uppercase tracking-wider leading-none">
                              {isLunas ? "LUNAS (TERVERIFIKASI)" : "BELUM LUNAS / KURANG BAYAR"}
                            </p>
                            <p className="text-[8.5px] mt-0.5 text-slate-600 truncate">
                              {isLunas 
                                ? "Pembayaran telah diterima sah."
                                : `Sisa kewajiban: ${formatRupiah(kurang)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* INVOICE FOOTER SIGNATURES */}
            <div className="pt-4 border-t border-slate-300">
              <div className="flex justify-between items-end text-center text-[10px]">
                <div className="w-36">
                  <p className="text-slate-500 mb-9 text-[9.5px]">Tanda Terima Pelanggan</p>
                  <div className="border-t border-slate-400 font-semibold text-slate-800 pt-0.5">
                    ( {customer.slice(0, 20)} )
                  </div>
                </div>
                <div className="w-40 text-center">
                  <p className="text-[9px] text-slate-500 mb-0.5">Bogor, {tanggalStr}</p>
                  <p className="text-slate-500 mb-8 text-[9.5px]">Biro Jasa SUN89</p>
                  <div className="border-t border-slate-400 font-semibold text-slate-800 pt-0.5">
                    ( Bagian Keuangan )
                  </div>
                </div>
              </div>
              <p className="text-center text-[8px] text-slate-400 mt-2.5 uppercase tracking-wider">
                Dokumen ini merupakan bukti pembayaran sah yang diterbitkan oleh sistem komputerisasi Biro Jasa SUN89
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons in Modal Footer */}
        <DialogFooter className="print:hidden p-4 sm:p-5 pt-3 border-t border-border/70 sticky bottom-0 bg-card z-10 flex items-center justify-between sm:justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Tutup
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyImage}
              disabled={isCopyingImage}
              className="h-8 text-xs gap-1.5 text-blue-600 border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 font-medium"
              title="Salin gambar faktur ke clipboard untuk langsung di-paste (Ctrl + V) ke WhatsApp"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{isCopyingImage ? "Menyalin..." : "Salin Gambar (Ctrl+V)"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={isCopyingImage}
              className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 font-semibold"
              title="Kirim rincian tagihan faktur ke WhatsApp customer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim ke WhatsApp</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs font-semibold">
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Faktur (A5)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
