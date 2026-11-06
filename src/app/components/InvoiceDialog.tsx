import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";
import { Printer, Download, AlertTriangle } from "lucide-react";
import { validateDocumentFinancialData } from "../../domain/finance/types";
import { toast } from "sonner";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
}

export function InvoiceDialog({ open, onOpenChange, order }: InvoiceDialogProps) {
  if (!order) return null;

  const val = validateDocumentFinancialData(order);

  const handlePrint = () => {
    window.print();
    toast.success("Invoice siap dicetak!");
  };

  const handleDownloadPDF = () => {
    toast.success("Invoice berhasil diunduh sebagai PDF!");
  };

  // Format invoice number: BJ_YY-MM_XXXX
  const invoiceDate = new Date(order.tanggal);
  const invoiceNo = `BJ_${invoiceDate.getFullYear().toString().slice(-2)}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}_${order.orderNo.split('-')[1]}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:border-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Invoice - {invoiceNo}</DialogTitle>
          <DialogDescription>
            Cetak atau unduh invoice untuk order ini
          </DialogDescription>
        </DialogHeader>

        {!val.isValidToPrint && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Perhatian:</strong> {val.validationErrorMessage || "Data tagihan tidak lengkap atau rincian belum terkonfigurasi. Dokumen tidak dapat dicetak."}
            </span>
          </div>
        )}

        {/* Invoice Content */}
        <div className="bg-white text-black p-8 rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl mb-2">SUN 89 BIRO JASA</h1>
              <div className="text-sm space-y-1">
                <p>Jl. Raya Sukahati No. 6</p>
                <p>Kel. Sukahati, Kec. Cibinong-Bogor</p>
                <p>Tel: 021-83715981</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl mb-4">INVOICE</h2>
              <div className="text-sm space-y-1">
                <div className="flex gap-4">
                  <span className="w-24">No Faktur</span>
                  <span>:</span>
                  <span className="font-mono">{invoiceNo}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24">Tanggal</span>
                  <span>:</span>
                  <span>{invoiceDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24">Nama Customer</span>
                  <span>:</span>
                  <span>{order.customer}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24">Alamat</span>
                  <span>:</span>
                  <span>-</span>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6 bg-black" />

          {/* Service Details Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2">KETERANGAN</th>
                  <th className="text-right py-2 px-2">HARGA</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-2">{order.layanan}</td>
                  <td className="text-right py-3 px-2">
                    {!val.isValidToPrint && val.total === 0 ? (
                      <span className="text-amber-600 font-medium">Belum Dikonfigurasi</span>
                    ) : (
                      `Rp ${(val.total ?? order.totalBiaya ?? 0).toLocaleString('id-ID')}`
                    )}
                  </td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-2">Nomor Polisi: {order.nopol}</td>
                  <td className="text-right py-3 px-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-1/2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span>Total Biaya:</span>
                  <span>
                    {!val.isValidToPrint && val.total === 0 ? (
                      <span className="text-amber-600 font-medium">Belum Dikonfigurasi</span>
                    ) : (
                      `Rp ${(val.total ?? order.totalBiaya ?? 0).toLocaleString('id-ID')}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span>Sudah Dibayar:</span>
                  <span className={val.dibayar > 0 ? "text-green-600" : "text-gray-600"}>
                    Rp {val.dibayar.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b-2 border-black">
                  <span>Kekurangan:</span>
                  {!val.isValidToPrint ? (
                    <span className="text-amber-600 font-medium">
                      {val.isNoSnapshot ? "Belum Dikonfigurasi" : "Data Tidak Valid"}
                    </span>
                  ) : val.isValidZero ? (
                    <span className="text-green-600 font-semibold">
                      Rp 0 (Bebas Biaya)
                    </span>
                  ) : val.isLunas ? (
                    <span className="text-green-600 font-semibold">
                      Rp 0 (Lunas)
                    </span>
                  ) : (
                    <span className={val.sisa > 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                      Rp {val.sisa.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-8 text-sm">
            <p className="mb-2">Catatan:</p>
            <p>Pembayaran ke Rekening BCA 7175095764 a/n. ANISA SUSANTI</p>
          </div>

          <Separator className="my-6 bg-black" />

          {/* Footer Signatures */}
          <div className="flex justify-between items-end">
            <div className="text-center">
              <p className="mb-16">Tanda Terima</p>
              <div className="border-t border-black w-48 mx-auto"></div>
            </div>
            <div className="text-center">
              <p className="mb-16">Hormat Kami</p>
              <div className="border-t border-black w-48 mx-auto"></div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={!val.isValidToPrint}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={handlePrint} disabled={!val.isValidToPrint} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
            <Printer className="w-4 h-4 mr-2" />
            Cetak Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
