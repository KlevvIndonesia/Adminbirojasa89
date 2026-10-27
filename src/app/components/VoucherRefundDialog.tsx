import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Printer, Download, MessageCircle, Wallet, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { LOGO_SUN89_BASE64 } from "../assets/logoSun89Base64";
import { formatRupiah, formatDateDDMMYYYY, angkaKeTerbilang } from "../utils/financeFormatters";
import { printA5Document } from "../utils/printA5Iframe";

export interface VoucherRefundData {
  orderNo?: string;
  invoiceNo?: string;
  voucherNo?: string;
  customer?: string;
  nopol?: string;
  layanan?: string;
  nominal?: number;
  tanggal?: string;
  metode?: string;
  bank?: string;
  noRekening?: string;
  namaRekening?: string;
  catatan?: string;
  kasirName?: string;
  approvedBy?: string;
  noHp?: string;
}

interface VoucherRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: VoucherRefundData | any;
}

export function VoucherRefundDialog({ open, onOpenChange, data }: VoucherRefundDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const customer = data.customer || data["Nama Customer"] || "Pelanggan";
  const nopol = data.nopol || data["Plat No"] || "-";
  const layanan = data.layanan || data["Jenis Pengurusan"] || "Pengurusan Dokumen Samsat";
  const rawTanggal = data.tanggal || data.tanggalCair || data.createdAt || new Date().toISOString();
  const tanggalStr = formatDateDDMMYYYY(rawTanggal);

  const orderNo = data.orderNo || data["Nomor Order"] || `ORD-${data.id || "001"}`;
  const voucherNo = data.voucherNo || `VCR-REF/${orderNo.replace(/^ORD-/, "")}`;
  const nominal = Number(data.nominal ?? data.nominalKelebihan ?? data.jumlahCashback ?? 0);

  const metode = data.metode || data.metodePencairan || data.metodePembayaran || "Transfer Bank";
  const bank = data.bank || data.namaBank || "BCA";
  const noRekening = data.noRekening || data.nomorRekening || "-";
  const namaRekening = data.namaRekening || data.namaPemilikRekening || customer;
  const isCash = metode.toLowerCase().includes("cash") || metode.toLowerCase().includes("tunai") || bank.toLowerCase() === "tunai";

  const kasir = data.kasirName || data.kasir || "Kasir Keuangan";
  const approvedBy = data.approvedBy || "Supervisor";
  const phone = data.noHp || data.nomorHP || data["No HP / WhatsApp"] || data.phone || "";

  // Format nama file: nomor order - nama customer - plat nomor polisi
  const cleanOrder = String(orderNo || "ORD").trim().replace(/[/\\?%*:|"<>]/g, "-");
  const cleanCustomer = String(customer || "Customer").trim().replace(/[/\\?%*:|"<>]/g, "-");
  const cleanNopol = String(nopol || "").trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, "-");
  const voucherFileName = `${cleanOrder} - ${cleanCustomer} - ${cleanNopol} (Voucher Refund)`;

  const handlePrint = () => {
    printA5Document(printAreaRef.current, voucherFileName);
    toast.success("Voucher pengeluaran kas siap dicetak!");
  };

  const handleDownload = () => {
    printA5Document(printAreaRef.current, voucherFileName);
    toast.info("Pilih 'Save as PDF' di jendela cetak browser (nama file terisi otomatis).");
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
    const messageText = `Halo Bpk/Ibu ${customer},\n\nKami menginformasikan bahwa pengembalian kelebihan bayar (Cashback) pengurusan dokumen Anda telah berhasil dicairkan:\n\n• *Nomor Voucher* : ${voucherNo}\n• *Nomor Order*   : ${orderNo}\n• *Nomor Polisi*  : ${String(nopol).toUpperCase()}\n• *Jenis Layanan* : ${layanan}\n• *Nominal Refund*: *${formatRupiah(nominal)}*\n• *Metode*        : ${isCash ? "Tunai Kas Kantor" : `Transfer ${bank} Rek. ${noRekening} (a/n ${namaRekening})`}\n• *Tanggal Cair*  : ${tanggalStr}\n\nTerima kasih atas kepercayaan Anda bertransaksi dengan Biro Jasa SUN89.`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank");
    toast.success(`Membuka WhatsApp untuk mengirim bukti voucher refund ke ${customer}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 bg-card text-card-foreground overflow-hidden">
        <DialogHeader className="print:hidden p-4 sm:p-5 pb-3 border-b border-border/70 sticky top-0 bg-card z-10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span>Voucher Pengeluaran Kas (Bukti Pengembalian Kelebihan Bayar)</span>
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground">{voucherNo}</span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Tanda bukti kas keluar resmi atas kelebihan bayar biaya Samsat konsumen
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Container on Screen */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30 flex justify-center">
          {/* Printable Sheet Container */}
          <div
            id="voucher-print-area"
            ref={printAreaRef}
            className="w-full max-w-[210mm] min-h-[148mm] bg-white text-slate-900 p-6 rounded-md shadow-md border border-slate-300 text-[11px] flex flex-col justify-between"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            {/* VOUCHER HEADER */}
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
                  <div className="inline-block bg-rose-700 text-white px-2.5 py-1 rounded text-[11px] font-black tracking-wider uppercase">
                    VOUCHER KAS KELUAR (REFUND)
                  </div>
                  <p className="text-[10px] font-mono text-slate-700 mt-1 font-bold">
                    No: {voucherNo}
                  </p>
                  <p className="text-[10px] text-slate-500">Tgl: {tanggalStr}</p>
                </div>
              </div>

              {/* VOUCHER CONTENT */}
              <div className="mt-4 space-y-2.5 text-xs text-slate-800">
                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Dikeluarkan Kepada</span>
                  <span className="font-bold text-slate-900 uppercase">: {customer}</span>
                </div>

                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Banyaknya Uang</span>
                  <div className="flex-1 bg-rose-50 p-2 rounded border border-rose-200 text-rose-900 font-bold font-mono text-sm flex items-center justify-between">
                    <span>{formatRupiah(nominal)}</span>
                    <span className="text-[11px] italic font-normal text-slate-700 font-sans">
                      (# {angkaKeTerbilang(nominal)} #)
                    </span>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Untuk Keperluan</span>
                  <span className="flex-1 text-slate-800 leading-relaxed">
                    : Pengembalian kelebihan setoran biaya pokok Samsat pengurusan <b>{layanan}</b> kendaraan nomor polisi <b>{String(nopol).toUpperCase()}</b>.
                    <br />
                    <span className="text-[10px] text-slate-500 font-mono">
                      (No. Order: {orderNo} • Ref. Invoice: INV-{orderNo.replace(/^ORD-/, "")})
                    </span>
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="w-36 text-slate-500 shrink-0 font-medium">Metode Penyerahan</span>
                  <span className="flex-1 text-slate-800 font-medium">
                    : {isCash ? (
                      <span className="font-bold text-slate-900">Tunai Kas Kantor (Handover Langsung)</span>
                    ) : (
                      <span>
                        Transfer <b>{bank}</b> • No. Rek: <b className="font-mono">{noRekening}</b> • a/n <b>{namaRekening}</b>
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* VOUCHER SIGNATURES */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex items-end justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border-2 border-emerald-600 text-emerald-700 bg-emerald-50 font-black text-xs uppercase tracking-wider">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>KAS KELUAR TERVERIFIKASI</span>
                </div>
                <p className="text-[8px] text-slate-400 italic">
                  * Tanda bukti pengeluaran kas sah untuk pencatatan buku kas kantor.
                </p>
              </div>

              <div className="flex items-center gap-6 text-center text-[10px]">
                <div className="w-24">
                  <p className="text-slate-500">Disetujui Oleh,</p>
                  <div className="h-12 flex items-end justify-center font-bold text-slate-900 border-b border-slate-400">
                    ( {approvedBy} )
                  </div>
                </div>
                <div className="w-24">
                  <p className="text-slate-500">Kasir Kas,</p>
                  <div className="h-12 flex items-end justify-center font-bold text-slate-900 border-b border-slate-400">
                    ( {kasir} )
                  </div>
                </div>
                <div className="w-24">
                  <p className="text-slate-500">Penerima Dana,</p>
                  <div className="h-12 flex items-end justify-center font-bold text-slate-800 border-b border-slate-400">
                    ( {customer.length > 12 ? customer.slice(0, 12) + "..." : customer} )
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
              <span>Cetak Voucher (A5)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
