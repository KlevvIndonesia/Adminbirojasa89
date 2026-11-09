import { useState, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Receipt,
  LogOut,
  Smartphone,
  Info,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { UserContext, getMessengerTasksForEmployee } from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { useFinanceStore } from "../../data/financeStore";

interface MessengerProfileViewProps {
  currentUser: UserContext;
  onLogout: () => void;
  onBack?: () => void;
}

export function MessengerProfileView({
  currentUser,
  onLogout,
  onBack,
}: MessengerProfileViewProps) {
  const { activeOrders } = useOrderStore();
  const { reimbursements } = useFinanceStore();

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  // Operational stats for current messenger
  const myTasks = useMemo(() => {
    return getMessengerTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  const completedTasksCount = useMemo(() => {
    return myTasks.filter((t) => t.status === "Selesai" || t.statusCode === "COMPLETED").length;
  }, [myTasks]);

  const activeTasksCount = useMemo(() => {
    return myTasks.filter((t) => t.status !== "Selesai" && t.statusCode !== "COMPLETED").length;
  }, [myTasks]);

  const myReimbursements = useMemo(() => {
    if (!currentUser.employeeId) return [];
    return reimbursements.filter((r) => r.employeeId === currentUser.employeeId);
  }, [reimbursements, currentUser.employeeId]);

  const totalPaidReimbursement = useMemo(() => {
    return myReimbursements
      .filter((r) => r.status === "Dibayar")
      .reduce((sum, r) => sum + r.amount, 0);
  }, [myReimbursements]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 text-primary font-bold hover:bg-primary/10 pl-1 rounded-xl -ml-1 text-sm sm:text-base min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          Kembali ke Dashboard
        </Button>
      )}

      {/* Profile Card Header */}
      <Card className="p-4 sm:p-6 rounded-2xl border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20 shadow-xs">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg sm:text-xl">
              {getInitials(currentUser.userName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">
                {currentUser.userName}
              </h2>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-semibold px-2 py-0.5">
                Petugas Lapangan
              </Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground mt-0.5">
              ID Karyawan: <strong className="text-foreground">{currentUser.employeeId || "EMP-0004"}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Wilayah Operasional: Jabodetabek (Bogor, Depok, Cibinong)
            </p>
          </div>
        </div>

        {/* Operational Statistics */}
        <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-border/60">
          <div className="p-3 rounded-xl bg-muted/40 text-center">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">
              Tugas Selesai
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {completedTasksCount}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 text-center">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">
              Tugas Aktif
            </span>
            <span className="text-xl sm:text-2xl font-bold text-primary mt-1 block">
              {activeTasksCount}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 text-center">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">
              Klaim Cair
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground mt-1.5 block truncate">
              Rp {totalPaidReimbursement > 0 ? (totalPaidReimbursement / 1000).toFixed(0) + "k" : "0"}
            </span>
          </div>
        </div>
      </Card>

      {/* Preferences & System Info (No Custom Theme Toggle) */}
      <Card className="p-4 sm:p-5 rounded-2xl border bg-card shadow-xs space-y-3.5">
        <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
          Pengaturan Aplikasi
        </h3>

        {/* Device & Mode Row */}
        <div className="flex items-center justify-between py-2.5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm sm:text-base font-semibold text-foreground">Mode Tampilan</p>
              <p className="text-xs text-muted-foreground">
                Mobile-First Workspace (360px - 430px)
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/10 text-emerald-600">
            Aktif
          </Badge>
        </div>

        {/* System Version */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm sm:text-base font-semibold text-foreground">Sistem & Versi</p>
              <p className="text-xs text-muted-foreground">
                Admin SUN89 v2.4 • In-Memory Operational Store
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-mono font-medium">v2.4-MOCK</span>
        </div>
      </Card>

      {/* Prominent Logout Button */}
      <Card className="p-4 sm:p-5 rounded-2xl border border-destructive/20 bg-destructive/5 shadow-xs space-y-2">
        <h4 className="text-sm sm:text-base font-bold text-destructive uppercase tracking-wider">
          Keluar dari Akun
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Pastikan seluruh tugas lapangan yang sedang berjalan sudah diperbarui sebelum mengakhiri sesi kerja Anda.
        </p>

        <Button
          variant="destructive"
          onClick={() => setIsLogoutDialogOpen(true)}
          className="w-full text-base font-semibold min-h-[48px] rounded-xl mt-3 shadow-xs"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Keluar dari Sistem
        </Button>
      </Card>

      {/* Logout Confirmation Dialog */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-xs w-full p-4 sm:p-5 gap-3.5 text-left">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Konfirmasi Keluar
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Apakah Anda yakin ingin keluar dari Messenger Workspace ({currentUser.userName})?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setIsLogoutDialogOpen(false)}
              className="min-h-[44px] text-sm"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsLogoutDialogOpen(false);
                onLogout();
              }}
              className="min-h-[44px] text-sm px-4"
            >
              Ya, Keluar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
