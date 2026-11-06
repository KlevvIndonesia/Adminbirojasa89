import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import {
  Bell,
  Mail,
  CheckCheck,
  Check,
  RotateCcw,
  Search,
  ArrowLeft,
  Clock,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useNotifications, NotificationItem } from "../data/notificationAdapter";
import { useNotificationSettings, NotificationLogItem } from "../data/notificationSettingsStore";
import { toast } from "sonner";
import { cn } from "./ui/utils";

export function NotificationHistory() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { logs, fetchLogs } = useNotificationSettings();

  const [activeTab, setActiveTab] = useState<"inapp" | "email">("inapp");

  // In-App Notifications Filter State
  const [inAppSearch, setInAppSearch] = useState("");
  const [inAppCategory, setInAppCategory] = useState<string>("all");
  const [inAppStatus, setInAppStatus] = useState<string>("all");
  const [inAppPage, setInAppPage] = useState(1);
  const [inAppItemsPerPage, setInAppItemsPerPage] = useState(25);

  // Email Logs Filter State
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatus, setEmailStatus] = useState<string>("all");
  const [emailPage, setEmailPage] = useState(1);
  const [emailItemsPerPage, setEmailItemsPerPage] = useState(25);

  const isInAppFilterDirty = inAppSearch.trim() !== "" || inAppCategory !== "all" || inAppStatus !== "all";
  const isEmailFilterDirty = emailSearch.trim() !== "" || emailStatus !== "all";

  const handleResetInAppFilters = () => {
    setInAppSearch("");
    setInAppCategory("all");
    setInAppStatus("all");
    setInAppPage(1);
  };

  const handleResetEmailFilters = () => {
    setEmailSearch("");
    setEmailStatus("all");
    setEmailPage(1);
  };

  // Filter In-App Notifications
  const filteredInApp = useMemo(() => {
    return notifications.filter((item) => {
      // Search
      if (inAppSearch.trim()) {
        const query = inAppSearch.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(query) ||
          item.customer.toLowerCase().includes(query) ||
          item.nopol.toLowerCase().includes(query) ||
          (item.orderNo && item.orderNo.toLowerCase().includes(query));
        if (!matches) return false;
      }
      // Category
      if (inAppCategory !== "all") {
        if (item.type !== inAppCategory) return false;
      }
      // Read Status
      if (inAppStatus === "unread" && item.isRead) return false;
      if (inAppStatus === "read" && !item.isRead) return false;

      return true;
    });
  }, [notifications, inAppSearch, inAppCategory, inAppStatus]);

  // Paginated In-App Notifications
  const paginatedInApp = useMemo(() => {
    const start = (inAppPage - 1) * inAppItemsPerPage;
    return filteredInApp.slice(start, start + inAppItemsPerPage);
  }, [filteredInApp, inAppPage, inAppItemsPerPage]);

  // Filter Email Logs
  const filteredEmailLogs = useMemo(() => {
    return logs.filter((log) => {
      if (emailSearch.trim()) {
        const query = emailSearch.toLowerCase();
        const matches =
          log.recipient.toLowerCase().includes(query) ||
          log.title.toLowerCase().includes(query) ||
          (log.referenceNo && log.referenceNo.toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (emailStatus !== "all" && log.status !== emailStatus) return false;
      return true;
    });
  }, [logs, emailSearch, emailStatus]);

  // Paginated Email Logs
  const paginatedEmailLogs = useMemo(() => {
    const start = (emailPage - 1) * emailItemsPerPage;
    return filteredEmailLogs.slice(start, start + emailItemsPerPage);
  }, [filteredEmailLogs, emailPage, emailItemsPerPage]);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 w-full min-w-0 text-left content-fluid">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </Button>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                markAllAsRead();
                toast.success("Semua notifikasi berhasil ditandai telah dibaca.");
              }}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tandai Semua Dibaca</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "inapp" | "email")}
        className="flex-1 flex flex-col min-h-0 space-y-4"
      >
        <TabsList className="bg-muted p-1 rounded-lg w-fit h-auto flex flex-wrap gap-1">
          <TabsTrigger
            value="inapp"
            className="h-8 px-3 text-xs gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
          >
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span>Notifikasi Operasional</span>
            {unreadCount > 0 && (
              <Badge status="error" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="email"
            className="h-8 px-3 text-xs gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
          >
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Riwayat Pengiriman Email (SMTP)</span>
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              ({logs.length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: NOTIFIKASI OPERASIONAL (IN-APP)                  */}
        {/* ======================================================== */}
        <TabsContent value="inapp" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0 space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari notifikasi, customer, nopol..."
                    value={inAppSearch}
                    onChange={(e) => {
                      setInAppSearch(e.target.value);
                      setInAppPage(1);
                    }}
                    className="pl-9 h-9 text-xs bg-input-background border-border"
                  />
                </div>

                {/* Category Select */}
                <Select
                  value={inAppCategory}
                  onValueChange={(val) => {
                    setInAppCategory(val);
                    setInAppPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36 h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    <SelectItem value="tagihan">Tagihan</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Baca Select */}
                <Select
                  value={inAppStatus}
                  onValueChange={(val) => {
                    setInAppStatus(val);
                    setInAppPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36 h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Status Baca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="unread">Belum Dibaca</SelectItem>
                    <SelectItem value="read">Sudah Dibaca</SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset Button */}
                {isInAppFilterDirty && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetInAppFilters}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Filter"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Total Info */}
              <div className="text-xs text-muted-foreground shrink-0">
                Menampilkan <span className="font-semibold text-foreground font-mono tabular-nums">{filteredInApp.length}</span> notifikasi
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <Table 
                containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                className={cn("w-full min-w-[800px]", filteredInApp.length === 0 && "h-full")}
              >
                <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-center bg-card">Status</TableHead>
                    <TableHead className="bg-card">Prioritas & Tipe</TableHead>
                    <TableHead className="bg-card">Pemberitahuan</TableHead>
                    <TableHead className="bg-card">Customer & Nopol</TableHead>
                    <TableHead className="text-right bg-card">Sisa / Nominal</TableHead>
                    <TableHead className="bg-card">Jatuh Tempo</TableHead>
                    <TableHead className="text-right bg-card">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInApp.length > 0 ? (
                    paginatedInApp.map((item) => {
                      const isUnread = !item.isRead;
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            "transition-colors",
                            isUnread ? "bg-primary/5 hover:bg-primary/10 font-medium" : "hover:bg-muted/30"
                          )}
                        >
                          {/* Status Dot */}
                          <TableCell className="text-center align-middle">
                            {isUnread ? (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full bg-primary"
                                title="Belum Dibaca"
                              />
                            ) : (
                              <span
                                className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30"
                                title="Sudah Dibaca"
                              />
                            )}
                          </TableCell>

                          {/* Prioritas & Tipe */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                status={
                                  item.priority === "high"
                                    ? "error"
                                    : item.priority === "medium"
                                    ? "warning"
                                    : "info"
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {item.priority === "high"
                                  ? "Urgent"
                                  : item.priority === "medium"
                                  ? "Penting"
                                  : "Normal"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-border/80 text-muted-foreground"
                              >
                                {item.type === "tagihan" ? "Tagihan" : "Operasional"}
                              </Badge>
                            </div>
                          </TableCell>

                          {/* Pemberitahuan / Title */}
                          <TableCell>
                            <div>
                              <p className={cn("text-xs leading-snug", isUnread ? "font-semibold text-foreground" : "text-foreground/80")}>
                                {item.title}
                              </p>
                              {item.orderNo && (
                                <p className="font-mono text-[11px] text-primary mt-0.5">
                                  {item.orderNo}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Customer & Nopol */}
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium text-foreground">{item.customer}</p>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                <span className="font-mono text-primary font-medium">{item.nopol}</span>
                                {item.layanan && (
                                  <>
                                    <span>•</span>
                                    <span>{item.layanan}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Sisa Tagihan */}
                          <TableCell className="text-right font-mono tabular-nums text-xs">
                            {item.sisa > 0 ? (
                              <span className="font-semibold text-rose-600 dark:text-rose-400">
                                Rp {item.sisa.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Lunas
                              </span>
                            )}
                          </TableCell>

                          {/* Jatuh Tempo */}
                          <TableCell className="text-xs">
                            {item.daysOverdue && item.daysOverdue > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                Telat {item.daysOverdue}h ({item.jatuhTempo})
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-mono">{item.jatuhTempo}</span>
                            )}
                          </TableCell>

                          {/* Aksi */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isUnread && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                  onClick={() => {
                                    markAsRead(item.id);
                                    toast.success("Notifikasi ditandai telah dibaca.");
                                  }}
                                  title="Tandai telah dibaca"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Dibaca</span>
                                </Button>
                              )}

                              {item.telepon && item.telepon !== "-" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-xs gap-1 border-border text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    const msg = `Halo ${item.customer}, pengingat mengenai ${item.title} untuk kendaraan ${item.nopol}. Sisa tagihan: Rp ${item.sisa.toLocaleString("id-ID")}. Terima kasih.`;
                                    window.open(
                                      `https://wa.me/${item.telepon.replace(/^0/, "62")}?text=${encodeURIComponent(msg)}`,
                                      "_blank"
                                    );
                                  }}
                                  title="Hubungi WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span className="hidden sm:inline">WA</span>
                                </Button>
                              )}

                              {item.orderNo && (
                                <Button
                                  size="sm"
                                  className="h-8 px-2 text-xs gap-1"
                                  onClick={() => navigate("/order/tracking")}
                                  title="Buka Order Tracking"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Order</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="h-full hover:bg-transparent">
                      <TableCell colSpan={7} className="text-center p-0 align-middle">
                        <EmptyState
                          title="Tidak ada notifikasi"
                          description={
                            isInAppFilterDirty
                              ? "Tidak ditemukan notifikasi yang cocok dengan filter atau kata kunci pencarian Anda."
                              : "Semua pengingat tagihan dan operasional telah tertangani."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="border-t border-border/80 p-3 bg-card shrink-0 mt-auto">
                <TablePagination
                  currentPage={inAppPage}
                  totalItems={filteredInApp.length}
                  itemsPerPage={inAppItemsPerPage}
                  onPageChange={setInAppPage}
                  onItemsPerPageChange={(val) => {
                    setInAppItemsPerPage(val);
                    setInAppPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: RIWAYAT PENGIRIMAN EMAIL (SMTP LOGS)             */}
        {/* ======================================================== */}
        <TabsContent value="email" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0 space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari penerima email, judul, ref..."
                    value={emailSearch}
                    onChange={(e) => {
                      setEmailSearch(e.target.value);
                      setEmailPage(1);
                    }}
                    className="pl-9 h-9 text-xs bg-input-background border-border"
                  />
                </div>

                {/* Status Pengiriman Select */}
                <Select
                  value={emailStatus}
                  onValueChange={(val) => {
                    setEmailStatus(val);
                    setEmailPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40 h-9 text-xs bg-input-background border-border">
                    <SelectValue placeholder="Status Pengiriman" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="BERHASIL">BERHASIL</SelectItem>
                    <SelectItem value="GAGAL">GAGAL</SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset Button */}
                {isEmailFilterDirty && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetEmailFilters}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Filter"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchLogs();
                    toast.success("Log riwayat pengiriman diperbarui.");
                  }}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  title="Segarkan Log"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan</span>
                </Button>
              </div>

              {/* Total Info */}
              <div className="text-xs text-muted-foreground shrink-0">
                Menampilkan <span className="font-semibold text-foreground font-mono tabular-nums">{filteredEmailLogs.length}</span> log pengiriman
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <Table 
                containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                className={cn("w-full min-w-[800px]", filteredEmailLogs.length === 0 && "h-full")}
              >
                <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-card">Waktu Kirim</TableHead>
                    <TableHead className="bg-card">Penerima Email</TableHead>
                    <TableHead className="bg-card">Referensi / Order</TableHead>
                    <TableHead className="bg-card">Judul Notifikasi</TableHead>
                    <TableHead className="text-center bg-card">Status Pengiriman</TableHead>
                    <TableHead className="bg-card">Keterangan / Pesan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmailLogs.length > 0 ? (
                    paginatedEmailLogs.map((log) => {
                      const isSuccess = log.status === "BERHASIL";
                      const dateFormatted = new Date(log.createdAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      return (
                        <TableRow key={log.id} className="hover:bg-muted/30">
                          {/* Waktu Kirim */}
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {dateFormatted}
                          </TableCell>

                          {/* Penerima Email */}
                          <TableCell className="font-mono text-xs text-foreground">
                            {log.recipient}
                          </TableCell>

                          {/* Referensi / Order */}
                          <TableCell>
                            {log.referenceNo ? (
                              <span className="font-mono text-xs text-primary font-medium">
                                {log.referenceNo}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>

                          {/* Judul Notifikasi */}
                          <TableCell className="text-xs font-medium text-foreground">
                            {log.title}
                          </TableCell>

                          {/* Status Pengiriman */}
                          <TableCell className="text-center">
                            {isSuccess ? (
                              <Badge status="success" className="gap-1 text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                BERHASIL
                              </Badge>
                            ) : (
                              <Badge status="error" className="gap-1 text-[11px]">
                                <XCircle className="w-3 h-3 text-rose-500" />
                                GAGAL
                              </Badge>
                            )}
                          </TableCell>

                          {/* Keterangan */}
                          <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                            {log.errorMessage || "Email berhasil dikirim ke server relay."}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="h-full hover:bg-transparent">
                      <TableCell colSpan={6} className="text-center p-0 align-middle">
                        <EmptyState
                          title="Belum ada riwayat pengiriman email"
                          description={
                            isEmailFilterDirty
                              ? "Tidak ada log pengiriman yang cocok dengan filter atau kata kunci pencarian Anda."
                              : "Log pengiriman email notifikasi otomatis akan tercatat di sini saat SMTP aktif."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="border-t border-border/80 p-3 bg-card shrink-0 mt-auto">
                <TablePagination
                  currentPage={emailPage}
                  totalItems={filteredEmailLogs.length}
                  itemsPerPage={emailItemsPerPage}
                  onPageChange={setEmailPage}
                  onItemsPerPageChange={(val) => {
                    setEmailItemsPerPage(val);
                    setEmailPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
