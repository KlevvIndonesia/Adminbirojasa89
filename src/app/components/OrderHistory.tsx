import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge, getStatusBadgeClass } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { TablePagination } from "./ui/TablePagination";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { 
  Search, 
  Eye, 
  FileDown, 
  Calendar, 
  DollarSign, 
  FileText, 
  Printer, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  Receipt, 
  Info, 
  CheckCircle, 
  PackageCheck, 
  Truck,
  Trash2,
  Download,
  Image as ImageIcon,
  MapPin,
  Clock,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { InvoiceDialog } from "./InvoiceDialog";
import { useOrderStore, OperationalOrder } from "../data/orderStore";
import { cn } from "./ui/utils";
import { generateDocumentSvgUrl, downloadDataUrl } from "../utils/documentSvgGenerator";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

export function OrderHistory() {
  const { archivedOrders, deleteArchivedOrder, clearArchivedOrders } = useOrderStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("bulan");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isPDFDialogOpen, setIsPDFDialogOpen] = useState(false);
  const [activeDocPreview, setActiveDocPreview] = useState<string>("STNK Asli");
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{ title: string; url: string } | null>(null);
  const [historyPreviewDoc, setHistoryPreviewDoc] = useState<{
    name: string;
    title: string;
    rawUrl?: string;
    fileType?: string;
    documentId?: string;
  } | null>(null);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);
  const userRole = (currentUser?.role || currentUser?.jabatan || "admin").toLowerCase();
  const canClearRekap = userRole === "admin" || userRole === "administrator" || userRole === "svp";

  // Derived view for Rekap Order from single source of truth store
  // Shows all operational completed / archived orders with their true financial reconciliation status
  const mappedArchivedOrders = useMemo(() => {
    return archivedOrders
      .filter((op: OperationalOrder) => {
        return op.currentStageName === "Selesai (Arsip)" || op.currentStep >= 8 || (op as any).isArchived;
      })
      .map((op: OperationalOrder) => {
        const orderDate = op.createdAt ? new Date(op.createdAt) : new Date();
        const totalEstimasiAwal = op.costSnapshot?.totalEstimasi || op.totalEstimasi || 0;
        const totalBiayaFinal = op.finalCost || op.payment?.totalBiaya || totalEstimasiAwal;
        const dibayar = op.payment?.dibayar ?? 0;
        const kurang = op.payment?.kurang ?? Math.max(0, totalBiayaFinal - dibayar);
        const overpayment = op.payment?.overpayment ?? Math.max(0, dibayar - totalBiayaFinal);
        
        const isCancelled = Boolean((op as any).isCancelled || op.currentStageName === "Dibatalkan" || (op as any).status === "Dibatalkan");
        let statusPembayaran = isCancelled ? "Dibatalkan" : op.payment?.statusPembayaran;
        if (!statusPembayaran) {
          if (kurang > 0) {
            statusPembayaran = dibayar > 0 ? "Kurang Bayar" : "Belum Bayar";
          } else if (overpayment > 0 || op.refundStatus === "PENDING" || op.payment?.refundStatus === "PENDING") {
            statusPembayaran = "Lebih Bayar";
          } else {
            statusPembayaran = "Lunas";
          }
        }

        return {
          orderNo: op.orderNo,
          isCancelled,
          cancellationReason: (op as any).cancellationReason,
          customer: op.customer,
          nomorHP: op.nomorHP || "-",
          layanan: op.layanan,
          nopol: op.nopol,
          samsat: op.wilayahSamsatAsal || "Samsat",
          tanggal: orderDate,
          completedAt: op.completedAt ? new Date(op.completedAt) : orderDate,
          totalEstimasiAwal,
          totalBiayaFinal,
          totalBiaya: totalBiayaFinal,
          dibayar,
          kurang,
          statusPembayaran,
          metodePembayaran: op.payment?.metodePembayaran || "-",
          namaBank: op.payment?.namaBank || "-",
          noRekening: op.payment?.noRekening || "-",
          tanggalBayar: op.payment?.tanggalBayar
            ? new Date(op.payment.tanggalBayar)
            : orderDate,
          settlementCondition: op.settlementCondition || op.payment?.settlementCondition || "BALANCED",
          refundStatus: op.refundStatus || op.payment?.refundStatus || "NONE",
          refundAmount: op.payment?.refundAmount || op.payment?.overpayment || 0,
          jemputDokumen: {
            messenger: op.messenger || "Ahmad Rizki",
            tanggal: op.tanggalJemput ? new Date(op.tanggalJemput) : orderDate,
          },
          prosesSamsat: {
            messenger: op.messenger || "Ahmad Rizki",
            tanggal: orderDate,
          },
          pengantaranKembali: {
            messenger: op.messengerPengantar || op.messenger || "Dedi Cahyadi",
            tanggal: op.tanggalPengantaran ? new Date(op.tanggalPengantaran) : orderDate,
          },
          clientDocuments: op.clientDocuments,
          updatedDocuments: op.updatedDocuments || [],
          rekapDocuments: op.rekapDocuments || [],
          rawOrder: op,
        };
      });
  }, [archivedOrders]);

  // Derived directly from the single source of truth store
  const orders = useMemo(() => {
    return [...mappedArchivedOrders].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());
  }, [mappedArchivedOrders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNo.toLowerCase().includes(term) ||
        order.customer.toLowerCase().includes(term) ||
        order.nopol.toLowerCase().includes(term)
      );
    }

    // Filter by date
    if (filterTanggal) {
      const selectedDate = new Date(filterTanggal);
      filtered = filtered.filter(order => {
        const orderDate = order.tanggal;
        
        if (filterPeriode === "hari") {
          return orderDate.toDateString() === selectedDate.toDateString();
        } else if (filterPeriode === "minggu") {
          const weekStart = new Date(selectedDate);
          weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return orderDate >= weekStart && orderDate <= weekEnd;
        } else if (filterPeriode === "bulan") {
          return orderDate.getMonth() === selectedDate.getMonth() && 
                 orderDate.getFullYear() === selectedDate.getFullYear();
        } else if (filterPeriode === "tahun") {
          return orderDate.getFullYear() === selectedDate.getFullYear();
        }
        return true;
      });
    }

    return filtered;
  }, [orders, searchTerm, filterTanggal, filterPeriode]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const getStatusColor = (status: string) => getStatusBadgeClass(status);

  const handleExportCSV = () => {
    toast.success("Data berhasil diekspor ke CSV!");
  };

  const handleExportPDF = () => {
    toast.success("Data berhasil diekspor ke PDF!");
  };

  return (
    <div className="flex-1 flex flex-col min-h-full space-y-4 md:space-y-6 p-4 md:p-6 w-full min-w-0 text-left">
      <Card className="p-4 md:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari order, nama customer, atau nomor polisi..."
              className="pl-9 bg-input-background border-border h-9 text-xs"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Select 
            value={filterPeriode} 
            onValueChange={(val) => {
              setFilterPeriode(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] bg-input-background border-border h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hari" className="text-xs">Per Hari</SelectItem>
              <SelectItem value="minggu" className="text-xs">Per Minggu</SelectItem>
              <SelectItem value="bulan" className="text-xs">Per Bulan</SelectItem>
              <SelectItem value="tahun" className="text-xs">Per Tahun</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              className="w-[160px] bg-input-background border-border h-9 text-xs"
              value={filterTanggal}
              onChange={(e) => {
                setFilterTanggal(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-border text-xs h-9">
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-border text-xs h-9">
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              PDF
            </Button>
            {canClearRekap && (
              <Button
                variant="outline"
                size="sm"
                disabled={orders.length === 0}
                onClick={() => setIsClearDialogOpen(true)}
                className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs h-9 gap-1.5 ml-auto"
                title="Bersihkan data tampilan Rekap Order"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Rekap Order
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 shrink-0">
          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Order Selesai</p>
                <p className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums mt-0.5">{filteredOrders.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Arsip Operasional</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Biaya Final</p>
                <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  Rp {filteredOrders.reduce((sum, o) => sum + o.totalBiayaFinal, 0).toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Akumulasi biaya selesai</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Estimasi Awal</p>
                <p className="text-xl font-bold tracking-tight text-foreground font-mono tabular-nums mt-0.5">
                  Rp {filteredOrders.reduce((sum, o) => sum + o.totalEstimasiAwal, 0).toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Basis estimasi awal</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Status Penyelesaian</p>
                {(() => {
                  const lunasCount = filteredOrders.filter(o => o.statusPembayaran === "Lunas").length;
                  const lunasPercent = filteredOrders.length > 0 ? Math.round((lunasCount / filteredOrders.length) * 100) : 100;
                  return (
                    <>
                      <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {lunasPercent}% Lunas ({lunasCount}/{filteredOrders.length})
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {lunasPercent === 100 ? "Bebas piutang / kewajiban" : `${filteredOrders.length - lunasCount} order perlu pelunasan`}
                      </p>
                    </>
                  );
                })()}
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/80 overflow-hidden shadow-2xs bg-card flex-1 flex flex-col min-h-0">
          <div className="w-full flex-1 flex flex-col min-h-0">
            <Table 
              containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-280px)] min-h-[160px]"
              className={`w-full min-w-[850px] ${paginatedOrders.length === 0 ? "h-full" : ""}`}
            >
              <TableHeader className="sticky top-0 z-10 bg-card border-b border-border/80 shadow-2xs">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Nomor Order</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Nama Customer</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Nomor Polisi</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Jenis Pengurusan</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Samsat</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card">Tanggal Selesai</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right bg-card">Total Biaya Final</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center bg-card">Status Pengerjaan</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right w-[95px] bg-card">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.orderNo} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
                      <TableCell className="px-3 py-2 text-xs font-mono font-semibold text-primary">{order.orderNo}</TableCell>
                      <TableCell className="px-3 py-2 text-xs font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{order.customer}</span>
                          {order.nomorHP && order.nomorHP !== "-" && (
                            <span className="text-[10px] text-muted-foreground font-mono">{order.nomorHP}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs font-mono">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted/60 border border-border text-[11px] font-mono text-foreground font-medium">
                          {order.nopol}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-foreground/80">{order.layanan}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-foreground/80">{order.samsat}</TableCell>
                      <TableCell className="px-3 py-2 text-xs font-mono text-foreground/80">
                        {order.completedAt?.toLocaleDateString('id-ID') || order.tanggal.toLocaleDateString('id-ID')}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs font-mono tabular-nums text-right font-medium text-emerald-600 dark:text-emerald-400">
                        Rp {order.totalBiayaFinal.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-center">
                        {order.isCancelled || order.statusPembayaran === "Dibatalkan" ? (
                          <Badge status="error" className="text-[10px] font-medium">
                            Dibatalkan
                          </Badge>
                        ) : order.statusPembayaran === "Kurang Bayar" ? (
                          <Badge status="warning" className="text-[10px] font-medium">
                            Kurang Bayar
                          </Badge>
                        ) : order.statusPembayaran === "Belum Bayar" ? (
                          <Badge status="neutral" className="text-[10px] font-medium">
                            Belum Bayar
                          </Badge>
                        ) : order.statusPembayaran === "Lebih Bayar" ? (
                          <Badge status="info" className="text-[10px] font-medium">
                            Lebih Bayar
                          </Badge>
                        ) : (
                          <Badge status="success" className="text-[10px] font-medium">
                            Selesai & Lunas
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-2 py-1.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsViewDialogOpen(true);
                            }}
                            title="Lihat Rekap Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsPDFDialogOpen(true);
                            }}
                            title="Lihat Dokumen PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsInvoiceDialogOpen(true);
                            }}
                            title="Cetak Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            onClick={() => setOrderToDelete(order)}
                            title="Hapus Rekap Order Sementara"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="h-full hover:bg-transparent">
                    <TableCell colSpan={9} className="text-center text-muted-foreground min-h-[200px] py-12 align-middle text-sm">
                      Tidak ada data order
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Standardized Table Pagination */}
          <div className="border-t border-border/80 p-3 bg-card shrink-0 mt-auto">
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredOrders.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(newSize) => {
                setItemsPerPage(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        </div>
      </Card>

      {/* View Dialog - Rekap Order Detail */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="border-border max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Rekap Detail Order — {selectedOrder?.orderNo}
              </DialogTitle>
              <Badge status="success" className="text-xs">
                Selesai & Lunas
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Rekapitulasi lengkap data operasional, rekonsiliasi finansial, alur timeline, dan arsip dokumen
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* SECTION 1: Ringkasan Order */}
              <Card className="p-4 bg-muted/20 border border-border space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  1. Ringkasan Order
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Nama Customer</span>
                    <span className="font-semibold text-foreground">{selectedOrder.customer}</span>
                    <span className="text-[10px] text-muted-foreground block">{selectedOrder.nomorHP}</span>
                  </div>
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Kendaraan & Nomor Polisi</span>
                    <span className="font-mono font-bold text-primary">{selectedOrder.nopol}</span>
                    <span className="text-[10px] text-muted-foreground block">{selectedOrder.rawOrder?.jenisKendaraan || "Kendaraan"}</span>
                  </div>
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Jenis Pengurusan & Samsat</span>
                    <span className="font-medium text-foreground">{selectedOrder.layanan}</span>
                    <span className="text-[10px] text-muted-foreground block">{selectedOrder.samsat}</span>
                  </div>
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Tanggal Selesai</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {selectedOrder.completedAt?.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Masuk: {selectedOrder.tanggal?.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              </Card>

              {/* SECTION 2: Rekonsiliasi Finansial */}
              <Card className="p-4 bg-muted/20 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    2. Rekonsiliasi Finansial
                  </h4>
                  <Badge 
                    status={
                      selectedOrder.isCancelled || selectedOrder.statusPembayaran === "Dibatalkan" ? "error" :
                      selectedOrder.statusPembayaran === "Kurang Bayar" ? "warning" :
                      selectedOrder.statusPembayaran === "Belum Bayar" ? "neutral" :
                      selectedOrder.statusPembayaran === "Lebih Bayar" ? "info" : "success"
                    } 
                    className="text-[10px]"
                  >
                    Status: {selectedOrder.isCancelled ? `Dibatalkan (${selectedOrder.cancellationReason || "Dibatalkan"})` : selectedOrder.statusPembayaran}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Estimasi Awal</span>
                    <span className="font-mono font-semibold text-foreground">
                      Rp {selectedOrder.totalEstimasiAwal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Total Biaya Final</span>
                    <span className="font-mono font-bold text-primary">
                      Rp {selectedOrder.totalBiayaFinal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">Total Terbayar</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Rp {selectedOrder.dibayar.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedOrder.kurang > 0 ? "Sisa Kewajiban" : selectedOrder.refundAmount > 0 ? "Kelebihan Bayar" : "Sisa Kewajiban"}
                    </span>
                    <span className={`font-mono font-bold ${
                      selectedOrder.kurang > 0 ? "text-amber-600 dark:text-amber-400" :
                      selectedOrder.refundAmount > 0 ? "text-blue-600 dark:text-blue-400" :
                      "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {selectedOrder.kurang > 0 
                        ? `Rp ${selectedOrder.kurang.toLocaleString('id-ID')} (${selectedOrder.statusPembayaran})` 
                        : selectedOrder.refundAmount > 0 
                          ? `Rp ${selectedOrder.refundAmount.toLocaleString('id-ID')} (Refund Pending)`
                          : "Rp 0 (Lunas)"}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-card border border-border flex flex-wrap justify-between items-center gap-2">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Metode Pembayaran: </span>
                    <span className="font-medium text-foreground">{selectedOrder.metodePembayaran}</span>
                    {selectedOrder.namaBank && selectedOrder.namaBank !== "-" && (
                      <span className="text-muted-foreground"> ({selectedOrder.namaBank})</span>
                    )}
                  </div>
                  {selectedOrder.tanggalBayar && (
                    <div className="text-muted-foreground">
                      Lunas pada: <span className="text-foreground font-mono">{selectedOrder.tanggalBayar.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>

                {selectedOrder.refundStatus === "PROCESSED" && selectedOrder.refundAmount > 0 && (
                  <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Kelebihan dana sebesar <strong>Rp {selectedOrder.refundAmount.toLocaleString('id-ID')}</strong> telah di-refund ke customer melalui Kas Kantor.</span>
                    </div>
                    <Badge status="neutral" className="text-[10px]">Refund Selesai</Badge>
                  </div>
                )}
              </Card>

              {/* SECTION 3: Timeline Alur Operasional (Stage 1 - Stage 8) */}
              <Card className="p-4 bg-muted/20 border border-border space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-primary" />
                  3. Timeline Alur Operasional (Stage 1 — 8)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { step: 1, title: "Verifikasi Order", desc: "Order dibuat & divalidasi", status: "Selesai" },
                    { step: 2, title: "Penjadwalan", desc: `Messenger: ${selectedOrder.jemputDokumen.messenger}`, status: "Selesai" },
                    { step: 3, title: "Cek Dokumen", desc: "Fisik dokumen diverifikasi", status: "Selesai" },
                    { step: 4, title: "Proses Samsat", desc: `${selectedOrder.samsat}`, status: "Selesai" },
                    { step: 5, title: "Biaya Final", desc: "Rekonsiliasi biaya aktual", status: "Selesai" },
                    { step: 6, title: "Supervisi SPV", desc: "Disetujui SPV Operasional", status: "Selesai" },
                    { step: 7, title: "Pengantaran", desc: `Messenger: ${selectedOrder.pengantaranKembali.messenger}`, status: "Selesai" },
                    { step: 8, title: "Serah Terima", desc: "Dokumen diterima customer", status: "Selesai" },
                  ].map((s) => (
                    <div key={s.step} className="p-2 rounded bg-card border border-border flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {s.step}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* SECTION 3B: Detail Petugas Kurir & Rincian Proses di Kantor Samsat */}
              <Card className="p-4 bg-muted/20 border border-border space-y-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  Rincian Penjemputan, Proses Samsat &amp; Serah Terima
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Card 1: Petugas Penjemputan */}
                  <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        1. Penjemputan Berkas
                      </span>
                      <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded font-medium border border-blue-500/20">
                        Selesai
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <p><span className="text-muted-foreground">Petugas Jemput: </span><strong className="text-foreground">{selectedOrder.jemputDokumen.messenger}</strong></p>
                      <p><span className="text-muted-foreground">Waktu: </span><span className="font-mono">{selectedOrder.jemputDokumen.tanggal ? new Date(selectedOrder.jemputDokumen.tanggal).toLocaleDateString('id-ID') : '-'}</span></p>
                      <p className="text-[10px] text-muted-foreground">Berkas fisik diterima dari customer &amp; diserahkan ke loket kantor.</p>
                    </div>

                    {/* Foto Bukti Penjemputan */}
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] text-muted-foreground block mb-1">Bukti Foto Penjemputan:</span>
                      {selectedOrder.rawOrder?.pickupProof?.photoUrl || selectedOrder.rawOrder?.jemputDokumen?.photoUrl ? (
                        <div
                          onClick={() => setPreviewPhotoModal({
                            title: `Bukti Foto Penjemputan — ${selectedOrder.orderNo}`,
                            url: selectedOrder.rawOrder?.pickupProof?.photoUrl || selectedOrder.rawOrder?.jemputDokumen?.photoUrl
                          })}
                          className="h-16 w-full rounded border border-border bg-muted/40 overflow-hidden cursor-pointer relative group flex items-center justify-center"
                        >
                          <img
                            src={selectedOrder.rawOrder?.pickupProof?.photoUrl || selectedOrder.rawOrder?.jemputDokumen?.photoUrl}
                            alt="Bukti Jemput"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-medium">
                            <Eye className="w-3 h-3" /> Lihat Foto
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded bg-muted/20 border border-dashed border-border/80 text-center">
                          <ImageIcon className="w-4 h-4 mx-auto text-muted-foreground/60 mb-0.5" />
                          <span className="text-[10px] text-muted-foreground block">
                            Belum ada foto penjemputan
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Tahapan di Samsat */}
                  <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5 text-primary" />
                        2. Proses di Kantor Samsat
                      </span>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium border border-primary/20">
                        {selectedOrder.samsat}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                      {[
                        { no: "A", name: "Cek Fisik Kendaraan & Gesek No. Rangka/Mesin" },
                        { no: "B", name: "Pendaftaran Berkas di Loket Samsat" },
                        { no: "C", name: "Penetapan Pajak Pokok & Jasa Raharja (SKPD)" },
                        { no: "D", name: "Kasir Pembayaran Pajak & Cetak Bukti Bayar" },
                        { no: "E", name: "Pengesahan STNK Baru & Cetak SKPD" },
                        { no: "F", name: "Pengambilan BPKB / Dokumen Akhir" },
                      ].map((sub) => (
                        <div key={sub.no} className="flex items-center justify-between gap-1 text-foreground/90">
                          <span className="truncate">• {sub.name}</span>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 3: Petugas Pengantaran Kembali */}
                  <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        3. Pengantaran Kembali
                      </span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium border border-emerald-500/20">
                        Diterima
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <p><span className="text-muted-foreground">Petugas Antar: </span><strong className="text-foreground">{selectedOrder.pengantaranKembali.messenger}</strong></p>
                      <p><span className="text-muted-foreground">Waktu: </span><span className="font-mono">{selectedOrder.pengantaranKembali.tanggal ? new Date(selectedOrder.pengantaranKembali.tanggal).toLocaleDateString('id-ID') : '-'}</span></p>
                      <p className="text-[10px] text-muted-foreground">Dokumen resmi diserahkan langsung ke customer dan telah diverifikasi.</p>
                    </div>

                    {/* Foto Bukti Pengantaran / Serah Terima */}
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] text-muted-foreground block mb-1">Bukti Foto Serah Terima:</span>
                      {selectedOrder.rawOrder?.deliveryHandover?.photoProofUrl || selectedOrder.rawOrder?.pengantaranKembali?.photoUrl ? (
                        <div
                          onClick={() => setPreviewPhotoModal({
                            title: `Bukti Foto Serah Terima — ${selectedOrder.orderNo}`,
                            url: selectedOrder.rawOrder?.deliveryHandover?.photoProofUrl || selectedOrder.rawOrder?.pengantaranKembali?.photoUrl
                          })}
                          className="h-16 w-full rounded border border-border bg-muted/40 overflow-hidden cursor-pointer relative group flex items-center justify-center"
                        >
                          <img
                            src={selectedOrder.rawOrder?.deliveryHandover?.photoProofUrl || selectedOrder.rawOrder?.pengantaranKembali?.photoUrl}
                            alt="Bukti Serah Terima"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-medium">
                            <Eye className="w-3 h-3" /> Lihat Foto
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded bg-muted/20 border border-dashed border-border/80 text-center">
                          <ImageIcon className="w-4 h-4 mx-auto text-muted-foreground/60 mb-0.5" />
                          <span className="text-[10px] text-muted-foreground block">
                            Belum ada foto serah terima pengantaran
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* SECTION 4: Dokumen Pengurusan (BEFORE vs AFTER) */}
              <Card className="p-4 bg-muted/20 border border-border space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  4. Dokumen Pengurusan (BEFORE vs AFTER)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* BEFORE: Dokumen Klien */}
                  <div className="p-3 rounded-lg border border-border bg-card space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-primary" />
                        Dokumen Masuk (BEFORE)
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                        Asli Klien
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: "stnk", label: "STNK Asli", doc: selectedOrder.clientDocuments?.stnk },
                        { key: "bpkb", label: "BPKB Asli", doc: selectedOrder.clientDocuments?.bpkb },
                        { key: "ktp", label: "KTP Pemilik", doc: selectedOrder.clientDocuments?.ktp },
                      ].map((item, idx) => {
                        const hasFile = Boolean(item.doc?.name || item.doc?.fileUrl);
                        const fileName = item.doc?.name || "Belum diunggah";
                        const fileType = item.doc?.fileType?.toUpperCase() || (item.doc?.name?.toLowerCase().endsWith(".pdf") ? "PDF" : "JPG");
                        const state = hasFile ? (item.doc?.status || "Terverifikasi") : "Belum Tersedia";

                        return (
                          <div key={idx} className="p-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground text-xs truncate">{item.label}</span>
                                  {hasFile && (
                                    <span className="px-1 py-0.2 rounded bg-muted text-[9px] font-mono text-muted-foreground uppercase">{fileType}</span>
                                  )}
                                </div>
                                <span className={cn("text-[10px] truncate font-mono block max-w-[130px]", !hasFile ? "text-amber-500 italic" : "text-muted-foreground")}>
                                  {fileName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border",
                                hasFile
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              )}>
                                {state}
                              </span>
                              {hasFile && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] gap-1"
                                  onClick={() => {
                                    setHistoryPreviewDoc({
                                      name: item.doc?.name || item.label,
                                      title: item.label,
                                      rawUrl: item.doc?.fileUrl,
                                      fileType: item.doc?.fileType,
                                      documentId: item.doc?.documentId,
                                    });
                                  }}
                                  title={`Preview ${item.label}`}
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Lihat</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AFTER: Dokumen Hasil Samsat */}
                  <div className="p-3 rounded-lg border border-border bg-card space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Dokumen Hasil (AFTER)
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Hasil Samsat
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const afterDocs = [
                          ...(selectedOrder.rekapDocuments?.filter((d: any) => d.phase === "AFTER" || d.category === "Dokumen Hasil") || []),
                          ...(selectedOrder.uploadedDocs || []),
                          ...(selectedOrder.deliveryHandover?.photoProofUrl ? [{
                            id: "handover-proof",
                            name: selectedOrder.deliveryHandover.fileName || "Bukti Serah Terima",
                            label: "Bukti Serah Terima",
                            fileUrl: selectedOrder.deliveryHandover.photoProofUrl,
                            fileType: selectedOrder.deliveryHandover.fileType || "image",
                            status: "Dokumen Diserahkan",
                          }] : []),
                        ];

                        if (afterDocs.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-muted-foreground italic bg-muted/10 rounded border border-dashed border-border">
                              Belum ada dokumen hasil yang diunggah untuk order ini.
                            </div>
                          );
                        }

                        return afterDocs.map((doc: any, idx: number) => {
                          const docName = doc.name || doc.label || doc.documentType || "Dokumen Hasil";
                          const fileType = doc.fileType?.toUpperCase() || (docName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE");
                          const docUrl = doc.fileUrl;
                          return (
                            <div key={doc.id || idx} className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground text-xs truncate">{docName}</span>
                                    <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 uppercase">{fileType}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground truncate font-mono block max-w-[130px]">{doc.fileName || docName}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {doc.status || "Tersedia"}
                                </span>
                                {docUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                                    onClick={() => {
                                      setHistoryPreviewDoc({
                                        name: docName,
                                        title: `Dokumen Hasil — ${docName}`,
                                        rawUrl: docUrl,
                                        fileType: doc.fileType,
                                        documentId: doc.id?.startsWith("doc-") ? undefined : doc.id,
                                      });
                                    }}
                                    title={`Preview ${docName}`}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Lihat</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <DialogFooter className="p-3 sm:p-4 border-t border-border shrink-0 bg-muted/20 flex items-center justify-between sm:justify-between">
            <div className="text-[11px] text-muted-foreground">
              Dokumen pengurusan telah lengkap diarsipkan secara digital
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={isPDFDialogOpen} onOpenChange={setIsPDFDialogOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Arsip Dokumen — {selectedOrder?.orderNo}</DialogTitle>
            <DialogDescription>
              Status dokumen berkas resmi yang telah diverifikasi dalam alur operasional order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Document List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { name: "STNK Asli", desc: "Surat Tanda Nomor Kendaraan" },
                  { name: "BPKB Asli", desc: "Buku Pemilik Kendaraan Bermotor" },
                  { name: "KTP Pemilik", desc: "Kartu Tanda Penduduk" },
                  { name: "Notice Pajak Baru", desc: "Surat Ketetapan Pajak Daerah" },
                ].map((doc) => {
                  const isSelected = activeDocPreview === doc.name;
                  return (
                    <Card
                      key={doc.name}
                      onClick={() => setActiveDocPreview(doc.name)}
                      className={cn(
                        "p-3.5 border bg-card shadow-2xs cursor-pointer transition-all",
                        isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-xs truncate">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{doc.desc}</p>
                          <span className={cn(
                            "inline-block mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {isSelected ? "Aktif" : "Pilih"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Active Document Status Panel */}
              <Card className="p-4 border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground text-xs">{activeDocPreview} — {selectedOrder.nopol}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Arsip Terverifikasi
                  </span>
                </div>

                {/* Real document preview container */}
                {(() => {
                  const lower = activeDocPreview.toLowerCase();
                  const clientKey = lower.includes("stnk") ? "stnk" : lower.includes("bpkb") ? "bpkb" : lower.includes("ktp") ? "ktp" : "";
                  const clientFile = clientKey ? selectedOrder.clientDocuments?.[clientKey] : null;
                  const rekapMatch = selectedOrder.rekapDocuments?.find((r: any) => r.label === activeDocPreview || r.documentType === activeDocPreview);
                  const updatedMatch = selectedOrder.updatedDocuments?.find((u: any) => u.name === activeDocPreview);
                  const realUrl = clientFile?.fileUrl || rekapMatch?.fileUrl || updatedMatch?.fileUrl;

                  if (!realUrl) {
                    return (
                      <div className="w-full flex flex-col items-center justify-center p-6 bg-muted/10 border border-dashed border-border rounded-lg min-h-[180px] text-center space-y-2">
                        <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                        <p className="text-xs font-semibold text-foreground">{activeDocPreview}</p>
                        <p className="text-[11px] text-muted-foreground max-w-sm">
                          Dokumen fisik tercatat dalam tahapan pengurusan, namun belum ada softcopy atau scan berkas digital yang diunggah ke sistem.
                        </p>
                      </div>
                    );
                  }

                  const isPdf = (clientFile?.fileType === "pdf" || realUrl.endsWith(".pdf")) && !realUrl.startsWith("data:image/");

                  return (
                    <div className="space-y-3">
                      <div className="w-full flex items-center justify-center p-2 bg-muted/20 border border-border rounded-lg min-h-[300px] max-h-[55vh] overflow-auto">
                        {isPdf ? (
                          <iframe
                            src={realUrl}
                            title={activeDocPreview}
                            className="w-full h-[50vh] rounded border border-border"
                          />
                        ) : (
                          <img
                            src={realUrl}
                            alt={activeDocPreview}
                            className="max-h-[50vh] max-w-full object-contain rounded shadow-xs"
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span className="font-mono">ID Arsip: ARC-{selectedOrder.orderNo}-{activeDocPreview.replace(/\s+/g, '')}</span>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (realUrl.startsWith("data:")) {
                              downloadDataUrl(realUrl, `${activeDocPreview.replace(/\s+/g, '_')}_${selectedOrder.orderNo}.${isPdf ? 'pdf' : 'png'}`);
                            } else {
                              const a = document.createElement("a");
                              a.href = realUrl;
                              a.download = `${activeDocPreview.replace(/\s+/g, '_')}_${selectedOrder.orderNo}`;
                              a.target = "_blank";
                              a.rel = "noreferrer";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }
                            toast.success(`Dokumen ${activeDocPreview} berhasil diunduh!`);
                          }}
                          className="h-7 px-3 text-xs gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                          variant="outline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Dokumen Ini</span>
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border shrink-0 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              Semua berkas operasional telah tersimpan dalam rekapitulasi permanen
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsPDFDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Hapus Rekap Order Sementara */}
      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent className="bg-card text-card-foreground border-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-4 h-4" />
              <span>Hapus Rekap Order Sementara?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Rekap order <strong className="font-mono text-foreground">{orderToDelete?.orderNo}</strong> ({orderToDelete?.customer}) akan dibersihkan dari daftar rekapitulasi sementara.
              </p>
              <p className="p-2.5 rounded bg-muted/40 border border-border text-[11px] text-foreground/80">
                Catatan: Master data transaksi dan seluruh histori keuangan tetap tersimpan aman di <strong>Data Penjualan</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="h-8 text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!orderToDelete) return;
                setIsDeleting(true);
                try {
                  const ok = deleteArchivedOrder(orderToDelete.orderNo);
                  if (ok) {
                    toast.success(`Rekap order ${orderToDelete.orderNo} berhasil dihapus dari rekap.`);
                    setOrderToDelete(null);
                  } else {
                    toast.error("Gagal menghapus rekap order.");
                  }
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus Rekap"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Clear Rekap Order (Section 7) */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="bg-card text-card-foreground border-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-4 h-4" />
              <span>Clear Rekap Order</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2.5 pt-1">
              <p className="text-foreground leading-relaxed font-medium">
                Tindakan ini akan membersihkan data Rekap Order saja. Data Penjualan, transaksi, tagihan, pembayaran, dan riwayat penjualan tidak akan dihapus atau diubah.
              </p>
              <div className="p-2.5 rounded bg-muted/40 border border-border text-[11px] text-muted-foreground">
                Arsip operasional Rekap Order akan dibersihkan dari tampilan. Seluruh catatan akuntansi dan bukti transaksi pada modul Finance tetap tersimpan utuh.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing} className="h-8 text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearing}
              onClick={async (e) => {
                e.preventDefault();
                setIsClearing(true);
                try {
                  const ok = clearArchivedOrders();
                  if (ok) {
                    toast.success("Rekap Order berhasil dibersihkan.");
                    setIsClearDialogOpen(false);
                  } else {
                    toast.error("Gagal membersihkan data Rekap Order.");
                  }
                } catch (err: any) {
                  toast.error(err.message || "Gagal membersihkan data Rekap Order.");
                } finally {
                  setIsClearing(false);
                }
              }}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
            >
              {isClearing ? "Membersihkan..." : "Ya, Clear Rekap Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Proof Modal for Messengers */}
      <Dialog open={!!previewPhotoModal} onOpenChange={() => setPreviewPhotoModal(null)}>
        <DialogContent className="max-w-xl bg-card text-card-foreground p-4">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>{previewPhotoModal?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 bg-muted/20 border border-border rounded-lg flex items-center justify-center my-2 max-h-[65vh] overflow-hidden">
            {previewPhotoModal?.url && (
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.title}
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            )}
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (previewPhotoModal) {
                  downloadDataUrl(previewPhotoModal.url, `${previewPhotoModal.title.replace(/\s+/g, '_')}.png`);
                  toast.success("Foto bukti berhasil diunduh!");
                }
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Foto</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPreviewPhotoModal(null)} className="h-8 text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <InvoiceDialog 
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        order={selectedOrder}
      />

      {/* Unified Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!historyPreviewDoc}
        onClose={() => setHistoryPreviewDoc(null)}
        title={historyPreviewDoc?.title || "Preview Dokumen"}
        documentName={historyPreviewDoc?.name}
        rawUrl={historyPreviewDoc?.rawUrl}
        fileType={historyPreviewDoc?.fileType}
        documentId={historyPreviewDoc?.documentId}
      />
    </div>
  );
}
