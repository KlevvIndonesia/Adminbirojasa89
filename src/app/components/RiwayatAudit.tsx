import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Search, Eye, FileDown, Calendar, Activity, Shield, Wallet, User, Truck, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { auditLog, type AuditLogEntry } from "../utils/auditLog";
import { TablePagination } from "./ui/TablePagination";

export function RiwayatAudit() {
  const [, setAuditTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    return auditLog.subscribe(() => setAuditTick((t) => t + 1));
  }, []);

  // Get filtered logs
  const getFilteredLogs = () => {
    const filters: any = {};
    
    if (filterRole !== "all") {
      filters.userRole = filterRole;
    }
    
    if (filterAction !== "all") {
      filters.action = filterAction;
    }
    
    if (filterModule !== "all") {
      filters.module = filterModule;
    }
    
    if (filterDate) {
      const selectedDate = new Date(filterDate);
      filters.startDate = new Date(selectedDate.setHours(0, 0, 0, 0));
      filters.endDate = new Date(selectedDate.setHours(23, 59, 59, 999));
    }

    let logs = auditLog.getLogs(filters);

    // Search filter
    if (searchTerm) {
      logs = logs.filter(log =>
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.module.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return logs;
  };

  const filteredLogs = getFilteredLogs();
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const getRoleBadge = (role: string) => {
    const icons: any = {
      administrator: Shield,
      finance: Wallet,
      admin: User,
      messenger: Truck,
    };
    
    const Icon = icons[role] || User;
    
    return (
      <Badge status="role">
        <Icon className="w-3 h-3 mr-1" />
        {role}
      </Badge>
    );
  };

  const getActionBadge = (action: string) => {
    return <span className="text-xs font-medium text-foreground/80">{action}</span>;
  };

  const handleExportCSV = () => {
    toast.success("Riwayat audit berhasil diekspor ke CSV!");
  };

  const handleExportPDF = () => {
    toast.success("Riwayat audit berhasil diekspor ke PDF!");
  };

  const handleViewDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setIsViewDialogOpen(true);
  };

  return (
    <div className="space-y-4 px-2 sm:px-3 lg:px-4 py-4 md:py-6 w-full min-w-0 text-left">
      <div>
        <nav className="text-xs text-muted-foreground flex items-center gap-1.5 pb-2" aria-label="Breadcrumb">
          <span>Master Data</span>
          <span>/</span>
          <span className="text-foreground font-medium">Riwayat Audit</span>
        </nav>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">Riwayat Audit</h3>
          <p className="text-xs md:text-sm text-muted-foreground">Lacak semua aktivitas pengguna dalam sistem</p>
        </div>
      </div>

      {auditLog.isLoading() && filteredLogs.length === 0 ? (
        <Card className="p-8 border border-border/80 bg-card shadow-xs flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Memuat riwayat aktivitas dari database...</p>
          <p className="text-xs text-muted-foreground mt-1">Menghubungkan ke API server...</p>
        </Card>
      ) : auditLog.getError() && filteredLogs.length === 0 ? (
        <Card className="p-8 border border-red-500/20 bg-red-500/5 shadow-xs flex flex-col items-center justify-center text-center">
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
      ) : (
        <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs space-y-3.5">
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
          {/* Filters and Export Toolbar */}
        <div className="flex flex-col lg:flex-row gap-2.5 justify-between items-stretch lg:items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterRole} onValueChange={(value) => {
              setFilterRole(value);
              setCurrentPage(1);
            }}>
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

            <Select value={filterAction} onValueChange={(value) => {
              setFilterAction(value);
              setCurrentPage(1);
            }}>
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

            <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 h-8 text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                className="bg-transparent border-none text-xs text-foreground focus:outline-none"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-border text-xs h-8 px-2.5 gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
                <span>CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-border text-xs h-8 px-2.5 gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </Button>
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
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Aktivitas</p>
                <p className="text-xl font-bold text-foreground font-mono tabular-nums mt-0.5">{filteredLogs.length}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Create</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  {filteredLogs.filter(l => l.action === "CREATE").length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Update</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-0.5">
                  {filteredLogs.filter(l => l.action === "UPDATE").length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Delete</p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-0.5">
                  {filteredLogs.filter(l => l.action === "DELETE").length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
          <div className="w-full flex-1 flex flex-col min-h-0">
            <Table 
              containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-280px)] min-h-[160px]"
              className={`w-full min-w-[700px] ${paginatedLogs.length === 0 ? "h-full" : ""}`}
            >
              <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 min-w-[110px] bg-card">Waktu</TableHead>
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 bg-card">Pengguna</TableHead>
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 text-center bg-card">Jabatan</TableHead>
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 text-center bg-card">Jenis Aksi</TableHead>
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 bg-card">Modul</TableHead>
                  <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 bg-card">Detail</TableHead>
                  <TableHead className="h-9 px-2 text-xs font-semibold text-foreground/80 text-center w-[75px] bg-card">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
                      <TableCell className="px-3.5 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="font-normal text-foreground/90">
                          {new Date(log.timestamp).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {" "}
                        <span className="text-[11px] text-muted-foreground/75 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="px-3.5 py-2 text-xs font-normal text-foreground/90">{log.userName}</TableCell>
                      <TableCell className="px-3.5 py-2 text-xs text-center">{getRoleBadge(log.userRole)}</TableCell>
                      <TableCell className="px-3.5 py-2 text-xs text-center">{getActionBadge(log.action)}</TableCell>
                      <TableCell className="px-3.5 py-2 text-xs font-normal text-foreground/90">{log.module}</TableCell>
                      <TableCell className="px-3.5 py-2 text-xs max-w-xs truncate text-muted-foreground">{log.details}</TableCell>
                      <TableCell className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                            onClick={() => handleViewDetails(log)}
                            title="Lihat Detail"
                            aria-label="Lihat detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                      Tidak ada data riwayat audit
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
      )}

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="border-border sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Detail Riwayat Audit</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Informasi lengkap aktivitas pengguna
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3.5 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">Waktu</p>
                  <p className="text-xs text-foreground/90 font-medium">
                    {new Date(selectedLog.timestamp).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    <br />
                    <span className="text-muted-foreground font-mono">
                      {new Date(selectedLog.timestamp).toLocaleTimeString('id-ID')}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">ID Pengguna</p>
                  <p className="text-xs font-mono text-muted-foreground">{selectedLog.userId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">Nama Pengguna</p>
                  <p className="text-xs text-foreground/90 font-medium">{selectedLog.userName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">Jabatan</p>
                  <div>{getRoleBadge(selectedLog.userRole)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">Aksi</p>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/80">Modul</p>
                  <p className="text-xs text-muted-foreground">{selectedLog.module}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground/80">IP Address</p>
                    <p className="text-xs font-mono text-muted-foreground">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground/80">Detail Aktivitas</p>
                <Card className="p-3 bg-secondary/20 border-border shadow-none">
                  <p className="text-xs leading-relaxed text-foreground/90">{selectedLog.details}</p>
                </Card>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground/80">Metadata</p>
                  <Card className="p-3 bg-secondary/20 border-border shadow-none">
                    <pre className="text-[11px] font-mono overflow-auto text-muted-foreground">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </Card>
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
    </div>
  );
}
