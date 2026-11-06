import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./ui/pagination";
import { TablePagination } from "./ui/TablePagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Plus, Search, Eye, FileText, Car, Clock, CheckCircle, MapPin, Calendar, User, CreditCard, Package } from "lucide-react";

// Generate completed order data (history)
const generateOrderData = () => {
  return [];
};

const initialOrderData = generateOrderData();

export interface OrderRecordItem {
  orderNo?: string;
  customer?: string;
  nopol?: string;
  layanan?: string;
  currentStageName?: string;
  isCancelled?: boolean;
  status?: string;
  totalBiaya?: number;
  [key: string]: unknown;
}

export interface OrderProps {
  initialOrders?: OrderRecordItem[];
}

export function computeOrderStats(orders: OrderRecordItem[] = []) {
  const activeOrders = orders.filter(
    (order) =>
      order.currentStageName !== "Dibatalkan" &&
      !order.isCancelled &&
      order.status !== "Dibatalkan"
  );
  const totalOrders = activeOrders.length;
  const totalRevenue = activeOrders.reduce((sum, order) => sum + (Number(order.totalBiaya) || 0), 0);
  return { totalOrders, totalRevenue, activeOrders };
}

export function Order({ initialOrders }: OrderProps = {}) {
  const [orderData] = useState<any[]>(initialOrders ?? initialOrderData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLayanan, setFilterLayanan] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Filter data
  const getFilteredData = () => {
    return orderData.filter(item => {
      const matchSearch = searchTerm === "" || 
        item.noOrder.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nopol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLayanan = filterLayanan === "all" || item.layanan === filterLayanan;
      
      return matchSearch && matchLayanan;
    });
  };

  // Pagination
  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Stats calculation (excludes cancelled orders)
  const { totalOrders, totalRevenue } = computeOrderStats(orderData);

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 w-full min-w-0 text-left">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-semibold text-foreground tracking-tight">History Order</h1>
        <p className="text-muted-foreground text-sm mt-1">Riwayat pesanan yang telah selesai</p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-3.5 sm:p-5 border border-border/80 bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Order Selesai</p>
                <h3 className="text-xl font-bold font-mono tabular-nums text-foreground">{totalOrders}</h3>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="p-3.5 sm:p-5 border border-border/80 bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Pendapatan</p>
                <h3 className="text-xl font-bold font-mono tabular-nums text-foreground">Rp {(totalRevenue / 1000000).toFixed(1)}jt</h3>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-3.5 sm:p-5 border border-border/80 bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-indigo-500/10">
                <Car className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Rata-rata per Order</p>
                <h3 className="text-xl font-bold font-mono tabular-nums text-foreground">Rp {totalOrders > 0 ? Math.round(totalRevenue / totalOrders / 1000) : 0}rb</h3>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari no order, nama customer, atau nomor polisi..." 
                className="pl-10 bg-input-background border-border"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>
            <Select 
              value={filterLayanan} 
              onValueChange={(value) => {
                setFilterLayanan(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full lg:w-[250px] bg-input-background border-border">
                <SelectValue placeholder="Semua Jenis Pengurusan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Layanan</SelectItem>
                <SelectItem value="Perpanjangan STNK 1 Tahun">Perpanjangan 1 Tahun</SelectItem>
                <SelectItem value="Perpanjangan STNK 5 Tahun">Perpanjangan 5 Tahun</SelectItem>
                <SelectItem value="Balik Nama">Balik Nama</SelectItem>
                <SelectItem value="Mutasi Antar Samsat">Mutasi Antar Samsat</SelectItem>
                <SelectItem value="Mutasi Luar Daerah">Mutasi Luar Daerah</SelectItem>
                <SelectItem value="Tarik Berkas">Tarik Berkas</SelectItem>
                <SelectItem value="Duplikat STNK">Duplikat STNK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info Bar */}
          <div className="mb-3 flex justify-between items-center shrink-0">
            <p className="text-xs text-muted-foreground">
              Menampilkan {filteredData.length} dari {orderData.length} order selesai
            </p>
          </div>
          
          {/* Table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
            <div className="w-full flex-1 flex flex-col min-h-0">
              <Table 
                containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                className={`w-full min-w-[750px] ${paginatedData.length === 0 ? "h-full" : ""}`}
              >
                <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16 font-semibold text-xs text-foreground/80 bg-card">No</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">No Order</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Nama Customer</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Nomor Polisi</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Jenis Pengurusan</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Tgl Order</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Tgl Selesai</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground/80 bg-card">Total Biaya</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-foreground/80 bg-card">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((order, index) => (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
                        <TableCell className="w-16 font-mono tabular-nums text-muted-foreground text-xs">{startIndex + index + 1}</TableCell>
                        <TableCell className="font-mono tabular-nums font-medium text-foreground text-xs">{order.noOrder}</TableCell>
                        <TableCell className="font-medium text-foreground text-xs">{order.customer}</TableCell>
                        <TableCell className="font-mono tabular-nums text-xs">{order.nopol}</TableCell>
                        <TableCell className="text-xs">{order.layanan}</TableCell>
                        <TableCell className="font-mono tabular-nums text-muted-foreground text-xs">{order.tanggalOrder}</TableCell>
                        <TableCell className="font-mono tabular-nums text-muted-foreground text-xs">{order.tanggalSelesai}</TableCell>
                        <TableCell className="font-mono tabular-nums font-semibold text-foreground text-xs">Rp {order.totalBiaya.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary rounded transition-colors"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="h-full hover:bg-transparent">
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Tidak ada data ditemukan
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
                totalItems={filteredData.length}
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
      </motion.div>

      {/* View Order Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detail Order - {selectedOrder?.noOrder}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Rincian data pelanggan, status kendaraan, pembayaran, dan riwayat timeline proses order.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            {selectedOrder && (
              <div className="space-y-4">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Invoice</p>
                        <p className="text-lg font-mono tabular-nums font-medium text-foreground">{selectedOrder.invoice}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <Badge status={selectedOrder.status}>
                          {selectedOrder.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Customer Info */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Informasi Customer
                  </h4>
                  <Card className="p-4 border border-border/80 bg-card shadow-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Nama Customer:</span>
                      <span className="font-medium text-foreground">{selectedOrder.customer}</span>
                      <span className="text-muted-foreground">Alamat:</span>
                      <span className="text-foreground">{selectedOrder.alamat}</span>
                      <span className="text-muted-foreground">Nomor Telepon:</span>
                      <span className="font-mono tabular-nums text-foreground">{selectedOrder.telepon}</span>
                      <span className="text-muted-foreground">Email:</span>
                      <span className="text-foreground">{selectedOrder.email}</span>
                    </div>
                  </Card>
                </div>

                {/* Order Details */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Detail Layanan
                  </h4>
                  <Card className="p-4 border border-border/80 bg-card shadow-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Nomor Polisi:</span>
                      <span className="font-mono tabular-nums font-medium text-foreground">{selectedOrder.nopol}</span>
                      <span className="text-muted-foreground">Jenis Pengurusan:</span>
                      <span className="text-foreground">{selectedOrder.layanan}</span>
                      <span className="text-muted-foreground">Wilayah Samsat:</span>
                      <span className="text-foreground">{selectedOrder.wilayah}</span>
                      <span className="text-muted-foreground">Messenger:</span>
                      <span className="text-foreground">{selectedOrder.messenger}</span>
                      <span className="text-muted-foreground">Nama Berkas:</span>
                      <span className="text-foreground">{selectedOrder.namaBerkas}</span>
                    </div>
                  </Card>
                </div>

                {/* Payment Info */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Informasi Pembayaran
                  </h4>
                  <Card className="p-4 border border-border/80 bg-card shadow-xs space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Biaya Jasa:</span>
                      <span className="font-mono tabular-nums font-medium text-foreground">Rp {selectedOrder.biayaJasa.toLocaleString('id-ID')}</span>
                      <span className="text-muted-foreground">Biaya Samsat:</span>
                      <span className="font-mono tabular-nums font-medium text-foreground">Rp {selectedOrder.biayaSamsat.toLocaleString('id-ID')}</span>
                      <span className="text-muted-foreground">Metode Pembayaran:</span>
                      <span className="text-foreground">{selectedOrder.metodePembayaran}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium">Total Biaya:</span>
                      <span className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        Rp {selectedOrder.totalBiaya.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </Card>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Timeline Proses
                  </h4>
                  <Card className="p-4 border border-border/80 bg-card shadow-xs">
                    <div className="relative space-y-4">
                      {selectedOrder.timeline.map((item: any, idx: number) => (
                        <div key={idx} className="flex gap-4 relative">
                          {/* Timeline line */}
                          {idx < selectedOrder.timeline.length - 1 && (
                            <div className="absolute left-[15px] top-8 w-[2px] h-[calc(100%-8px)] bg-border" />
                          )}
                          
                          {/* Timeline dot */}
                          <div className="relative z-10">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-primary" />
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="text-sm font-medium text-foreground">{item.status}</h5>
                                <p className="text-xs text-muted-foreground">{item.keterangan}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono tabular-nums text-foreground">{item.tanggal}</p>
                                <p className="text-xs font-mono tabular-nums text-muted-foreground">{item.waktu}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Catatan */}
                {selectedOrder.catatan && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Catatan</h4>
                    <Card className="p-4 border border-border/80 bg-muted/40 shadow-2xs">
                      <p className="text-sm text-muted-foreground">{selectedOrder.catatan}</p>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
