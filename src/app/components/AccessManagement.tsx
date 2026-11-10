/**
 * Authoritative Access Management (Hak Akses)
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Features:
 * - Direct integration with permissionStore (SSoT)
 * - Role selection: SVP, Admin, Finance, Messenger
 * - Fine-grained View (Lihat) & Manage (Kelola) toggles per module
 * - Stage-level action controls for Order Tracking (Stage 4 & Stage 6)
 * - Authoritative "Simpan Hak Akses" persistence with toast "Hak akses berhasil disimpan."
 * - Audit logging of permission changes
 * - "Reset ke Standar" capability
 */

import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  Check,
  LayoutDashboard,
  Wallet,
  Database,
  Users,
  Truck,
  ShoppingCart,
  Info,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
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
import { toast } from "sonner";
import { auditLog } from "../utils/auditLog";
import {
  usePermissionStore,
  permissionStore,
  Role,
  RolePermissions,
} from "../data/permissionStore";

interface AccessManagementProps {
  currentUserId: string;
  currentUserName: string;
}

interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  isParent?: boolean;
}

interface ModuleGroup {
  name: string;
  icon: any;
  modules: ModuleDefinition[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    modules: [
      { id: "dashboard", label: "Dashboard Utama", description: "Melihat ringkasan metrik, grafik, dan statistik performa biro jasa." },
    ],
  },
  {
    name: "Finance",
    icon: Wallet,
    modules: [
      { id: "finance-profit", label: "Profit", description: "Monitoring margin keuntungan dan rincian transaksi per berkas." },
      { id: "finance-kas-messenger", label: "Kas Messenger", description: "Pencatatan uang jalan operasional dan petty cash kurir." },
      { id: "finance-kas-kantor", label: "Kas Kantor", description: "Kelola kas besar kantor, penerimaan loket, dan mutasi saldo." },
      { id: "finance-pengeluaran", label: "Pengeluaran Operasional", description: "Catat dan verifikasi pos beban pengeluaran harian." },
      { id: "finance-penjualan", label: "Data Penjualan", description: "Laporan rekap omzet dan volume berkas terjual." },
      { id: "finance-tagihan", label: "Tagihan (Invoicing)", description: "Pengelolaan piutang berkas bayar di akhir dan status invoice." },
      { id: "finance-laba-rugi", label: "Laba Rugi (P&L)", description: "Analisis laporan laba bersih berkala." },
    ],
  },
  {
    name: "Master Data",
    icon: Database,
    modules: [
      { id: "master-samsat", label: "Samsat Wilayah", description: "Kelola daftar Samsat asal dan tujuan." },
      { id: "master-biaya-layanan", label: "Biaya Layanan", description: "Atur tarif jasa layanan, opsi nembak, dan biaya kurir." },
      { id: "master-harga-dasar-samsat", label: "Harga Dasar Samsat", description: "Komponen biaya resmi Samsat (PKB, PNBP, STNK, BPKB)." },
    ],
  },
  {
    name: "Manajemen",
    icon: Users,
    modules: [
      { id: "manajemen-karyawan", label: "Data Karyawan", description: "Kelola identitas karyawan, kurir, dan petugas loket." },
      { id: "manajemen-pengguna", label: "Manajemen Pengguna", description: "Kelola akun login sistem dan reset password (DOB)." },
      { id: "access-management", label: "Hak Akses & Role", description: "Konfigurasi matriks izin akses per role (Halaman ini)." },
      { id: "audit-log", label: "Riwayat Aktivitas (Audit)", description: "Log audit seluruh mutasi dan aktivitas operasional." },
    ],
  },
  {
    name: "Messenger Operasional",
    icon: Truck,
    modules: [
      { id: "messenger-task", label: "Messenger Task", description: "Penugasan lapangan, jemput berkas, dan update status loket." },
      { id: "messenger-history", label: "Messenger History", description: "Arsip pekerjaan kurir selesai, kronologi proses, dan audit pengajuan biaya operasional." },
    ],
  },
  {
    name: "Order Workflow",
    icon: ShoppingCart,
    modules: [
      { id: "buat-order", label: "Buat Order Baru", description: "Pencatatan order loket / antar jemput berkas masuk ke sistem." },
      { id: "order-tracking", label: "Order Tracking", description: "Pipeline operasional 8 tahap pemrosesan berkas." },
      { id: "order-history", label: "Rekap Order (Selesai)", description: "Arsip dan riwayat seluruh order yang telah tuntas." },
    ],
  },
];

export function AccessManagement({ currentUserId, currentUserName }: AccessManagementProps) {
  const { matrix, error, isStale, refresh, resetToDefaults } = usePermissionStore();

  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [localPermissions, setLocalPermissions] = useState<RolePermissions>(() =>
    JSON.parse(JSON.stringify(permissionStore.getRolePermissions("admin")))
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Sync when selectedRole changes or external matrix updates
  useEffect(() => {
    const validRole = (["svp", "admin", "finance", "messenger"] as Role[]).includes(selectedRole) ? selectedRole : "admin";
    if (validRole !== selectedRole) {
      setSelectedRole(validRole);
      return;
    }
    const canonical = permissionStore.getRolePermissions(validRole);
    setLocalPermissions(JSON.parse(JSON.stringify(canonical)));
    setHasChanges(false);
  }, [selectedRole, matrix]);

  const handleToggleView = (_moduleId: string) => {
    // View-only static RBAC (BD-RBAC-06)
  };

  const handleToggleManage = (_moduleId: string) => {
    // View-only static RBAC (BD-RBAC-06)
  };

  const handleSave = async () => {
    try {
      await permissionStore.saveRolePermissions(selectedRole, localPermissions);

      auditLog.log({
        userId: currentUserId || "usr-admin",
        userName: currentUserName || "Administrator",
        userRole: "administrator",
        action: "UPDATE",
        module: "Hak Akses",
        details: `Memperbarui matriks hak akses untuk role ${selectedRole.toUpperCase()}`,
        metadata: {
          role: selectedRole,
          permissions: localPermissions,
        },
      });

      toast.success("Hak akses berhasil disimpan.");
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan hak akses.");
    }
  };

  const handleReset = () => {
    setIsResetDialogOpen(true);
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      await resetToDefaults();
      toast.success("Hak akses berhasil direset ke standar.");
      setHasChanges(false);
      setIsResetDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal mereset hak akses.");
    } finally {
      setIsResetting(false);
    }
  };

  const roleMeta: Record<Role, { label: string; desc: string; badge: string; color: string }> = {
    svp: {
      label: "Supervisi & SVP (Administrator)",
      desc: "Akses penuh (Full Access) ke seluruh modul keuangan, master data, konfigurasi hak akses, dan approval supervisi.",
      badge: "Full Privilege",
      color: "border-purple-500 text-purple-600 bg-purple-500/10",
    },
    administrator: {
      label: "Administrator",
      desc: "Identik dengan role SVP.",
      badge: "Full Privilege",
      color: "border-purple-500 text-purple-600 bg-purple-500/10",
    },
    admin: {
      label: "Admin Operasional",
      desc: "Entri order, operasional dokumen, data karyawan, dan master data. View-only pada Stage 4 (Samsat) & Stage 6 (Supervisi). Tanpa akses Keuangan, Pengguna, dan Hak Akses.",
      badge: "Operasional Loket",
      color: "border-blue-500 text-blue-600 bg-blue-500/10",
    },
    finance: {
      label: "Finance & Kasir",
      desc: "Akses penuh seluruh modul Keuangan (Profit, Kas Kantor, Kas Messenger, Pengeluaran, Tagihan, Laba Rugi). Tanpa akses mutasi operasional.",
      badge: "Financial Control",
      color: "border-emerald-500 text-emerald-600 bg-emerald-500/10",
    },
    messenger: {
      label: "Messenger Lapangan",
      desc: "Akses web untuk melihat penugasan lapangan (Messenger Task) dan verifikasi berkas fisik.",
      badge: "Kurir Lapangan",
      color: "border-amber-500 text-amber-600 bg-amber-500/10",
    },
    unknown: {
      label: "Tidak Dikenal",
      desc: "Role tidak dikenal atau belum di-assign (Fail-Closed). Tidak memiliki izin akses.",
      badge: "No Access",
      color: "border-red-500 text-red-600 bg-red-500/10",
    },
  };

  return (
    <div className="w-full space-y-5 min-w-0 text-left content-fluid">
      {/* ACTION TOOLBAR & CONTEXT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Pengaturan Matriks Perizinan Role
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atur izin akses navigasi halaman, tombol mutasi data, dan pembatasan aksi workflow per role secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 px-3 text-xs gap-1.5 border-primary/40 bg-primary/5 text-primary font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>Dokumentasi Hak Akses Statis</span>
          </Badge>
        </div>
      </div>

      {isStale && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Peringatan Sinkronisasi:</strong> Gagal memperbarui matriks hak akses dari server ({error}). Menampilkan data tersimpan lokal.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            className="h-7 text-xs gap-1 hover:bg-amber-500/20"
          >
            <RefreshCw className="w-3 h-3" />
            Coba Sinkron Ulang
          </Button>
        </div>
      )}

      {/* STATIC RBAC DOCUMENTATION BANNER (BD-RBAC-06) */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-700 dark:text-blue-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <div>
          <p className="font-semibold text-foreground">Kebijakan Hak Akses Statis (BD-RBAC-06)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Matriks hak akses dan kewenangan sistem ditentukan secara terpusat oleh Backend sebagai Single Source of Truth (SSoT). Halaman ini berfungsi sebagai dokumentasi izin aktif untuk setiap role. Pengubahan izin secara dinamis telah dinonaktifkan untuk menjamin integritas tata kelola operasional dan kepatuhan RBAC.
          </p>
        </div>
      </div>

      {/* ROLE SELECTOR TABS (4 CANONICAL ROLES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {(["svp", "admin", "finance", "messenger"] as Role[]).map((role) => {
          const isSelected = selectedRole === role;
          const meta = roleMeta[role];
          return (
            <Card
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-3.5 cursor-pointer transition-all border ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                  {role.toUpperCase()}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.color}`}>
                  {meta.badge}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                {meta.label}
              </p>
            </Card>
          );
        })}
      </div>

      {/* ACTIVE ROLE SUMMARY BANNER */}
      <Card className="p-3.5 border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Konfigurasi Matriks: <strong className="text-primary">{selectedRole.toUpperCase()}</strong>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-2xl">
              {roleMeta[selectedRole].desc}
            </p>
          </div>
        </div>

        {hasChanges && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs shrink-0 self-start sm:self-center">
            Ada Perubahan Belum Disimpan
          </Badge>
        )}
      </Card>

      {/* DETAILED MODULE & SUBMODULE PERMISSION MATRIX */}
      <div className="space-y-4">
        {MODULE_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <Card key={group.name} className="p-4 border border-border/80 bg-card space-y-3 rounded-xl shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <GroupIcon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Modul {group.name}
                  </h3>
                </div>
                <div className="hidden sm:flex items-center gap-6 pr-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="w-16 text-center">Lihat</span>
                  <span className="w-16 text-center">Kelola</span>
                </div>
              </div>

              <div className="space-y-2.5 divide-y divide-border/40">
                {group.modules.map((mod) => {
                  const perm = localPermissions.modules[mod.id] || { view: false, manage: false };
                  return (
                    <div
                      key={mod.id}
                      className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-0.5 max-w-xl">
                        <Label className="text-xs font-medium text-foreground cursor-pointer" onClick={() => handleToggleView(mod.id)}>
                          {mod.label}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">{mod.description}</p>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 self-start sm:self-center pr-2 bg-muted/30 sm:bg-transparent p-1.5 sm:p-0 rounded-lg">
                        {/* Toggle Lihat (View) */}
                        <div className="flex items-center sm:justify-center gap-1.5 sm:gap-0 sm:w-16">
                          <span className="text-[10px] sm:hidden text-muted-foreground font-medium">Lihat:</span>
                          <Switch
                            checked={perm.view}
                            disabled={true}
                            aria-label={`View permission for ${mod.label}`}
                          />
                        </div>

                        {/* Toggle Kelola (Manage) */}
                        <div className="flex items-center sm:justify-center gap-1.5 sm:gap-0 sm:w-16">
                          <span className="text-[10px] sm:hidden text-muted-foreground font-medium">Kelola:</span>
                          <Switch
                            checked={perm.manage}
                            disabled={true}
                            aria-label={`Manage permission for ${mod.label}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* BOTTOM INFO BAR */}
      <div className="p-3 sm:p-3.5 bg-card/95 backdrop-blur-md rounded-xl border border-border/80 shadow-xs flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span>
          Matriks hak akses bersifat statis dan mengikat seluruh pengguna sesuai role kanonikal masing-masing (SVP, Admin, Finance, Messenger) berdasarkan Backend SSoT.
        </span>
      </div>

      {/* Confirmation Dialog: Reset Hak Akses ke Standar */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={(open) => { if (!open && !isResetting) setIsResetDialogOpen(false); }}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-primary" />
              Reset Hak Akses ke Standar Pabrik?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2">
              <p>
                Apakah Anda yakin ingin mengembalikan seluruh izin hak akses untuk seluruh role ke konfigurasi default sistem?
              </p>
              <p className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-[11px] font-medium leading-relaxed">
                Seluruh kustomisasi hak akses yang telah disimpan pada role Admin dan Finance akan diganti dengan pengaturan bawaan sistem.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={isResetting} className="text-xs h-8">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReset();
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mereset...
                </>
              ) : (
                "Ya, Reset Standar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
