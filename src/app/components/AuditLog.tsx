import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Search, Eye, FileDown, FileText, Printer, RotateCcw, AlertTriangle, RefreshCw, Loader2, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { auditLog, AuditLogEntry } from "../utils/auditLog";
import { exportToCSV, exportToPrintablePDF } from "../utils/exportUtils";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";

interface AuditLogProps {
  currentUserRole: 'administrator' | 'finance' | 'admin' | 'messenger' | 'svp' | string;
}

export function AuditLog({ currentUserRole }: AuditLogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [auditTick, setAuditTick] = useState(0);

  // Clear History Modal States
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false);
  const [clearConfirmationInput, setClearConfirmationInput] = useState("");
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Subscribe to auditLog for real-time reactivity
  useEffect(() => {
    return auditLog.subscribe(() => setAuditTick((t) => t + 1));
  }, []);

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterRole("all");
    setFilterModule("all");
    setFilterAction("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || filterRole !== "all" || filterModule !== "all" || filterAction !== "all");

  // Get filtered logs (Full dataset scope based on active filters & search)
  const filteredLogs = useMemo(() => {
    let logs = auditLog.getLogs();

    if (filterRole !== "all") {
      logs = logs.filter(log => log.userRole === filterRole);
    }

    if (filterModule !== "all") {
      logs = logs.filter(log => log.module.toLowerCase().includes(filterModule.toLowerCase()));
    }

    if (filterAction !== "all") {
      logs = logs.filter(log => log.action === filterAction);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      logs = logs.filter(log => 
        log.userName.toLowerCase().includes(q) ||
        log.module.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }

    return logs;
  }, [searchTerm, filterRole, filterModule, filterAction, auditTick]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const getRoleBadge = (role: string) => {
    return <Badge status="role">{role}</Badge>;
  };

  const getActionBadge = (action: string) => {
    return <span className="text-xs font-medium text-foreground/80">{action}</span>;
  };

  // Full dataset CSV Export with Formula Injection Protection & UTF-8 BOM
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("Tidak ada data riwayat untuk diekspor.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    exportToCSV({
      filename: `riwayat-aktivitas-${today}.csv`,
      columns: [
        { header: "No", format: (_, idx) => idx + 1 },
        { 
          header: "Waktu", 
          format: (log) => {
            const d = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
            return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
          }
        },
        { header: "Pengguna", key: "userName" },
        { header: "ID Pengguna", key: "userId" },
        { header: "Jabatan", key: "userRole" },
        { header: "Jenis Aksi", key: "action" },
        { header: "Modul", key: "module" },
        { header: "Detail Aktivitas", key: "details" },
      ],
      data: filteredLogs,
    });
    toast.success(`Berhasil mengekspor seluruh ${filteredLogs.length} catatan riwayat ke CSV.`);
  };

  // Official Landscape Print / PDF Export with Repeated Header & Full Filtered Scope
  const handleExportPDF = () => {
    if (filteredLogs.length === 0) {
      toast.error("Tidak ada data riwayat untuk diekspor.");
      return;
    }
    try {
      exportToPrintablePDF({
        title: "LAPORAN RIWAYAT AKTIVITAS",
        subtitle: "Rekam jejak operasional, audit trail, dan aktivitas keamanan sistem",
        metadata: [
          { label: "Total Record", value: `${filteredLogs.length} Aktivitas` },
          { label: "Filter Jabatan", value: filterRole === "all" ? "Semua Jabatan" : filterRole },
          { label: "Filter Aksi", value: filterAction === "all" ? "Semua Aksi" : filterAction },
          { label: "Filter Modul", value: filterModule === "all" ? "Semua Modul" : filterModule },
          { label: "Pencarian", value: searchTerm || "Semua Data" },
        ],
        columns: [
          { header: "No", width: "40px", align: "center", format: (_, idx) => idx + 1 },
          { 
            header: "Waktu", 
            width: "130px",
            format: (log) => {
              const d = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
              return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
            }
          },
          { header: "Pengguna", width: "135px", key: "userName" },
          { header: "Jabatan", width: "100px", align: "center", format: (log) => `<span class="badge">${log.userRole}</span>` },
          { header: "Aksi", width: "85px", align: "center", format: (log) => `<span class="badge">${log.action}</span>` },
          { header: "Modul", width: "115px", key: "module" },
          { header: "Detail Aktivitas", key: "details" },
        ],
        data: filteredLogs,
      });
      toast.success(`Membuka dokumen cetak untuk ${filteredLogs.length} catatan riwayat...`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuka jendela cetak PDF.");
    }
  };

  // Permanent Clear History Execution
  const isClearConfirmationValid = clearConfirmationInput === "Hapus riwayat aktivitas";

  const handleExecuteClearHistory = async () => {
    if (!isClearConfirmationValid) return;
    setIsClearingHistory(true);
    try {
      const res = await auditLog.clearLogsOnServer();
      toast.success(res.message || "Riwayat aktivitas berhasil dibersihkan secara permanen.");
      setIsClearHistoryOpen(false);
      setClearConfirmationInput("");
      setCurrentPage(1);
    } catch (err: any) {
      toast.error(err?.message || "Gagal membersihkan riwayat aktivitas dari database.");
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleViewDocument = () => {
    setIsDocumentViewOpen(true);
  };

  const handlePrintInvoice = () => {
    setIsInvoiceViewOpen(true);
  };

  const handlePrint = () => {
    window.print();
    toast.success("Invoice siap dicetak!");
  };

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  if (auditLog.isLoading() && filteredLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-full space-y-4 w-full min-w-0 text-left content-fluid">
        <Card className="p-8 border border-border/80 bg-card shadow-xs flex-1 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Memuat riwayat aktivitas dari database...</p>
          <p className="text-xs text-muted-foreground mt-1">Menghubungkan ke API server...</p>
        </Card>
      </div>
    );
  }

  if (auditLog.getError() && filteredLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-full space-y-4 w-full min-w-0 text-left content-fluid">
        <Card className="p-8 border border-red-500/20 bg-red-500/5 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Gagal Memuat Riwayat Aktivitas</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{auditLog.getError()}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditLog.initFromApi()}
            className="mt-4 gap-2 border-border text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full space-y-4 w-full min-w-0 text-left content-fluid">
      <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs space-y-3.5 flex-1 flex flex-col min-h-0">
        {auditLog.isStale() && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Peringatan Sinkronisasi:</strong> Gagal memperbarui data dari server ({auditLog.getError()}). Menampilkan data riwayat cache lokal terakhir.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => auditLog.initFromApi()}
              className="h-7 text-xs gap-1 hover:bg-amber-500/20"
            >
              <RefreshCw className="w-3 h-3" />
              Coba Sinkron Ulang
            </Button>
          </div>
        )}

        {/* Filters, Search, and Action Toolbar */}
        <div className="flex flex-col lg:flex-row gap-2.5 justify-between items-stretch lg:items-center shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Select 
              value={filterRole} 
              onValueChange={(value) => {
                setFilterRole(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px] bg-background border-border h-8 text-xs font-normal">
                <SelectValue placeholder="Semua Jabatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua Jabatan</SelectItem>
                <SelectItem value="administrator" className="text-xs">Administrator</SelectItem>
                <SelectItem value="finance" className="text-xs">Finance</SelectItem>
                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                <SelectItem value="messenger" className="text-xs">Messenger</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filterAction} 
              onValueChange={(value) => {
                setFilterAction(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full sm:w-[125px] bg-background border-border h-8 text-xs font-normal">
                <SelectValue placeholder="Semua Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua Aksi</SelectItem>
                <SelectItem value="CREATE" className="text-xs">Create</SelectItem>
                <SelectItem value="UPDATE" className="text-xs">Update</SelectItem>
                <SelectItem value="DELETE" className="text-xs">Delete</SelectItem>
                <SelectItem value="EXPORT" className="text-xs">Export</SelectItem>
                <SelectItem value="VIEW" className="text-xs">View</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="border-border text-xs h-8 px-2.5 gap-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}

            <div className="flex items-center gap-1.5">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV} 
                className="border-border text-xs h-8 px-2.5 gap-1.5"
                title="Ekspor seluruh record hasil filter ke CSV"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>CSV</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF} 
                className="border-border text-xs h-8 px-2.5 gap-1.5"
                title="Cetak atau simpan seluruh record ke dokumen PDF resmi"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </Button>

              {/* Immutable Audit Trail Badge (BD-RBAC-01) */}
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 text-xs h-8 px-2.5 gap-1.5 shrink-0 font-normal"
                title="Audit log dilindungi oleh kebijakan imutabilitas (BD-RBAC-01)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Audit Trail Imutabel</span>
              </Badge>
            </div>
          </div>

          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari pengguna, modul, atau detail..."
              className="pl-8 bg-background border-border h-8 text-xs font-normal placeholder:font-normal placeholder:text-muted-foreground/60"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                handleFilterChange();
              }}
            />
          </div>
        </div>

        {/* Standardized Table View */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
          <div className="w-full flex-1 flex flex-col min-h-0">
            <Table 
              containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-280px)] min-h-[160px]"
              className={`w-full min-w-[780px] ${paginatedLogs.length === 0 ? "h-full" : ""}`}
            >
              <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px] text-center text-xs h-9 font-semibold text-foreground/80 bg-card px-2">No</TableHead>
                  <TableHead className="w-[135px] text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Waktu</TableHead>
                  <TableHead className="w-[145px] text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Pengguna</TableHead>
                  <TableHead className="w-[105px] text-center text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Jabatan</TableHead>
                  <TableHead className="w-[95px] text-center text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Jenis Aksi</TableHead>
                  <TableHead className="w-[125px] text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Modul</TableHead>
                  <TableHead className="min-w-[220px] text-xs h-9 font-semibold text-foreground/80 bg-card px-3.5">Detail</TableHead>
                  <TableHead className="w-[65px] text-center text-xs h-9 font-semibold text-foreground/80 bg-card px-2">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log, idx) => {
                    const globalIndex = startIndex + idx + 1;
                    const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
                        <TableCell className="w-[50px] text-center text-xs text-muted-foreground font-mono px-2 py-2 align-middle">
                          {globalIndex}
                        </TableCell>
                        <TableCell className="w-[135px] px-3.5 py-2 text-xs text-muted-foreground whitespace-nowrap align-middle">
                          <span className="font-normal text-foreground/90">
                            {logDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          {" "}
                          <span className="text-[11px] text-muted-foreground/75 font-mono">
                            {logDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell className="w-[145px] px-3.5 py-2 text-xs font-normal text-foreground/90 align-middle">
                          {log.userName}
                        </TableCell>
                        <TableCell className="w-[105px] px-3.5 py-2 text-xs text-center align-middle">
                          {getRoleBadge(log.userRole)}
                        </TableCell>
                        <TableCell className="w-[95px] px-3.5 py-2 text-xs text-center align-middle">
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell className="w-[125px] px-3.5 py-2 text-xs font-normal text-foreground/90 align-middle">
                          {log.module}
                        </TableCell>
                        <TableCell className="min-w-[220px] px-3.5 py-2 text-xs text-foreground/80 align-middle break-words">
                          {log.details}
                        </TableCell>
                        <TableCell className="w-[65px] px-2 py-1.5 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                              onClick={() => {
                                setSelectedLog(log);
                                setIsViewDialogOpen(true);
                              }}
                              title="Lihat Detail"
                              aria-label="Lihat detail aktivitas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow className="h-full hover:bg-transparent">
                    <TableCell colSpan={8} className="text-center py-8 align-middle p-0">
                      <EmptyState
                        title="Tidak ada data aktivitas"
                        description="Belum ada riwayat aktivitas yang cocok dengan pencarian atau filter saat ini."
                      />
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
              totalItems={filteredLogs.length}
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

      {/* Clear History Dialog Removed per BD-RBAC-01 (Immutable Audit Trail) */}

      {/* View Log Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="border-border sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Detail Aktivitas</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Informasi lengkap tentang aktivitas ini</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3.5 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">Waktu</Label>
                  <p className="text-xs text-foreground/90 font-medium">
                    {(selectedLog.timestamp instanceof Date ? selectedLog.timestamp : new Date(selectedLog.timestamp)).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <br />
                    <span className="text-muted-foreground font-mono">
                      {(selectedLog.timestamp instanceof Date ? selectedLog.timestamp : new Date(selectedLog.timestamp)).toLocaleTimeString('id-ID')}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">Pengguna</Label>
                  <p className="text-xs text-foreground/90 font-medium">{selectedLog.userName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">Jabatan</Label>
                  <div>{getRoleBadge(selectedLog.userRole)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">Aksi</Label>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">Modul</Label>
                  <p className="text-xs text-muted-foreground">{selectedLog.module}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground/80">IP Address</Label>
                  <p className="text-xs font-mono text-muted-foreground">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80">Detail Aktivitas</Label>
                <Card className="p-3 bg-secondary/20 border-border shadow-none">
                  <p className="text-xs leading-relaxed text-foreground/90">{selectedLog.details}</p>
                </Card>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground/80">Metadata</Label>
                  <Card className="p-3 bg-secondary/20 border-border shadow-none">
                    <pre className="text-[11px] font-mono overflow-auto text-muted-foreground">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </Card>
                </div>
              )}

              {/* Action buttons for order-related logs */}
              {selectedLog.module.includes('Order') && (
                <div className="flex gap-2 pt-3 border-t border-border">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleViewDocument}
                    className="flex-1 h-8 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Lihat Dokumen PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePrintInvoice}
                    className="flex-1 h-8 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    Cetak Invoice
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document View Dialog */}
      <Dialog open={isDocumentViewOpen} onOpenChange={setIsDocumentViewOpen}>
        <DialogContent className="border-border sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Dokumen PDF</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Pratinjau dokumen yang telah diupload</DialogDescription>
          </DialogHeader>

          <div className="bg-secondary/10 rounded-lg p-6 min-h-[360px] flex items-center justify-center border border-border mt-3">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs font-medium text-foreground mb-1">Pratinjau Dokumen PDF</p>
              <p className="text-[11px] text-muted-foreground mb-4">
                (Dalam implementasi production, ini akan menampilkan PDF viewer)
              </p>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                Download Dokumen
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsDocumentViewOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={isInvoiceViewOpen} onOpenChange={setIsInvoiceViewOpen}>
        <DialogContent className="border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Invoice</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Cetak invoice untuk customer</DialogDescription>
          </DialogHeader>

          <div className="bg-white text-black p-6 rounded-lg border border-border mt-3" id="invoice-content">
            <div className="flex justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold mb-1">SUN 89 BIRO JASA</h2>
                <p className="text-xs">Jl. Raya Sukahati No. 6</p>
                <p className="text-xs">Kel. Sukahati, Kec. Cibinong-Bogor</p>
                <p className="text-xs">Tel: 021-83715981</p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-bold mb-1">INVOICE</h3>
                <p className="text-xs font-mono">No Faktur: BJ_25-09_1915</p>
                <p className="text-xs font-mono">Tanggal: 16/09/2025</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium">Customer: BP DEDE</p>
              <p className="text-xs text-gray-600">Alamat: -</p>
            </div>

            <table className="w-full mb-4 text-xs">
              <thead>
                <tr className="border-b border-black font-semibold">
                  <th className="text-left py-1.5">KETERANGAN</th>
                  <th className="text-right py-1.5">HARGA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5">Perpanjangan STNK 1 Tahun</td>
                  <td className="text-right font-mono tabular-nums">Rp 750.000</td>
                </tr>
                <tr>
                  <td className="py-1.5">Biaya Jasa</td>
                  <td className="text-right font-mono tabular-nums">Rp 150.000</td>
                </tr>
                <tr className="border-t border-black font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="text-right font-mono tabular-nums">Rp 900.000</td>
                </tr>
              </tbody>
            </table>

            <div className="text-xs mb-4">
              <p className="text-gray-600">Catatan: Pembayaran ke Rekening BCA 7175095764 a/n. ANISA SUSANTI</p>
            </div>

            <div className="flex justify-between mt-8 text-xs">
              <div className="text-center">
                <p className="mb-8">Tanda Terima</p>
                <p>_______________</p>
              </div>
              <div className="text-center">
                <p className="mb-8">Hormat Kami</p>
                <p>_______________</p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 flex justify-end">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsInvoiceViewOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Cetak Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
