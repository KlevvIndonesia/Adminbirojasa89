import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import {
  Bell,
  Shield,
  Key,
  Save,
  Plus,
  Trash2,
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Info,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useNotificationSettings,
  EMAIL_REGEX,
} from "../data/notificationSettingsStore";
import { APP_CONFIG } from "../config/appConfig";

export function Settings() {
  const {
    settings,
    smtpStatus,
    logs,
    isSaving,
    isTesting,
    saveSettings,
    addRecipientEmail,
    removeRecipientEmail,
    toggleNotificationType,
    sendTestEmail,
    fetchLogs,
  } = useNotificationSettings();

  // Local state for adding email input
  const [newEmail, setNewEmail] = useState("");
  const [emailInputError, setEmailInputError] = useState<string | null>(null);

  // Local state for test email target
  const [testTargetEmail, setTestTargetEmail] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  // Security password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleAddEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailInputError(null);

    const trimmed = newEmail.trim();
    if (!trimmed) {
      setEmailInputError("Alamat email tidak boleh kosong.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailInputError("Format email tidak valid (contoh: finance@sunbirojasa.com).");
      return;
    }

    const result = addRecipientEmail(trimmed);
    if (!result.success) {
      setEmailInputError(result.message);
      toast.error(result.message);
      return;
    }

    setNewEmail("");
    toast.success(`Email '${trimmed}' ditambahkan ke daftar.`);
  };

  const handleRemoveEmail = (index: number, email: string) => {
    if (settings.recipientEmails.length <= 1) {
      toast.error("Minimal harus menyisakan satu alamat email penerima notifikasi.");
      return;
    }
    const result = removeRecipientEmail(index);
    if (result.success) {
      toast.success(result.message);
    }
  };

  const handleSaveNotificationSettings = async () => {
    if (settings.recipientEmails.length === 0) {
      toast.error("Tambahkan minimal satu alamat email penerima sebelum menyimpan.");
      return;
    }

    const res = await saveSettings();
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleSendTestEmail = async () => {
    const target = testTargetEmail.trim() || settings.recipientEmails[0];
    if (!target) {
      toast.error("Tentukan alamat email penerima untuk pengujian.");
      return;
    }

    const res = await sendTestEmail(target);
    setTestResult({
      success: res.success,
      message: res.message,
      timestamp: new Date().toLocaleTimeString("id-ID"),
    });

    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Harap isi seluruh field kata sandi.");
      return;
    }
    if (newPassword.trim().length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    if (oldPassword === newPassword) {
      toast.error("Kata sandi baru tidak boleh sama dengan kata sandi saat ini.");
      return;
    }

    const token = localStorage.getItem("auth_token");
    if (!token) {
      toast.error("Sesi autentikasi tidak ditemukan. Harap login kembali.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Gagal memperbarui kata sandi.");
      }

      if (data.data?.token) {
        localStorage.setItem("auth_token", data.data.token);
      }

      toast.success(data.message || "Kata sandi akun berhasil diperbarui.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui kata sandi.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-5 w-full min-w-0 text-left content-fluid">
      {/* Tabs Navigation & Scope Badge Toolbar */}
      <Tabs defaultValue="notifications" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="grid w-full sm:w-[380px] grid-cols-2 bg-secondary/40 p-1 rounded-lg">
            <TabsTrigger value="notifications" className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifikasi & Email
            </TabsTrigger>
            <TabsTrigger value="security" className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Keamanan Akun
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="text-xs py-1 px-2.5 bg-muted/30 border-border/80">
              <Globe className="w-3.5 h-3.5 mr-1 text-primary" />
              Cakupan: Global Aplikasi SUN89
            </Badge>
          </div>
        </div>

        {/* TAB 1: NOTIFIKASI & EMAIL */}
        <TabsContent value="notifications" className="space-y-6 outline-hidden">
          {/* Section 1: Alamat Email Penerima Notifikasi */}
          <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Alamat Email Penerima Notifikasi
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Daftar alamat email tim kantor/finance yang akan menerima alert tagihan, order, dan proses sistem.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[11px] font-normal w-fit">
                  {settings.recipientEmails.length} Alamat Terdaftar
                </Badge>
              </div>

              {/* Input Tambah Email Baru */}
              <div className="space-y-2">
                <Label htmlFor="input-new-recipient" className="text-xs font-medium text-foreground">
                  Tambah Email Penerima Baru
                </Label>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                  <div className="relative flex-1">
                    <Input
                      id="input-new-recipient"
                      type="email"
                      placeholder="contoh: keuangan@sunbirojasa.com"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        if (emailInputError) setEmailInputError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      className={`bg-input-background ${emailInputError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddEmail()}
                    className="shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Email
                  </Button>
                </div>
                {emailInputError && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {emailInputError}
                  </p>
                )}
              </div>

              {/* Daftar Email Tersimpan */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Daftar Email Penerima Aktif:
                </Label>
                {settings.recipientEmails.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Belum ada alamat email penerima. Tambahkan minimal satu alamat agar notifikasi dapat dikirim.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {settings.recipientEmails.map((email, idx) => (
                      <div
                        key={`${email}-${idx}`}
                        className="flex items-center justify-between p-2.5 px-3 rounded-lg border border-border/70 bg-secondary/15 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {email}
                          </span>
                          {idx === 0 && (
                            <Badge variant="default" className="text-[10px] h-4.5 px-1.5 font-normal">
                              Utama
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEmail(idx, email)}
                          aria-label={`Hapus email ${email}`}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Section 2: Atur Jenis Notifikasi */}
          <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Jenis Notifikasi & Acara Sistem
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pilih kejadian operasional yang memicu pengiriman email notifikasi ke alamat penerima terdaftar.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 1. Reminder Tagihan */}
                <div className="flex items-start justify-between p-3.5 rounded-lg border border-border/60 bg-secondary/15 hover:bg-secondary/25 transition-colors gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        Reminder & Pengingat Tagihan
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                        Aktif di Modul Finance
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pengingat otomatis untuk tagihan jatuh tempo dan tagihan belum lunas yang memerlukan tindak lanjut penagihan.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyTagihanReminder}
                    onCheckedChange={(checked) =>
                      toggleNotificationType("notifyTagihanReminder", checked)
                    }
                    aria-label="Aktifkan Reminder Tagihan"
                  />
                </div>

                {/* 2. Tagihan Baru atau Perubahan Tagihan */}
                <div className="flex items-start justify-between p-3.5 rounded-lg border border-border/60 bg-secondary/15 hover:bg-secondary/25 transition-colors gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        Tagihan Baru & Perubahan Status Pembayaran
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                        Aktif di Invoice
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pemberitahuan setiap kali invoice baru diterbitkan, verifikasi bukti transfer, atau pelunasan sisa tagihan tercatat.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyTagihanPerubahan}
                    onCheckedChange={(checked) =>
                      toggleNotificationType("notifyTagihanPerubahan", checked)
                    }
                    aria-label="Aktifkan Notifikasi Perubahan Tagihan"
                  />
                </div>

                {/* 3. Update Status Order */}
                <div className="flex items-start justify-between p-3.5 rounded-lg border border-border/60 bg-secondary/15 hover:bg-secondary/25 transition-colors gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        Update Status Dokumen & Order
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                        Aktif di Modul Order
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pemberitahuan perubahan progres tahapan dokumen kendaraan (Proses Samsat, Verifikasi, Berkas Siap Ambil, Selesai).
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOrderUpdate}
                    onCheckedChange={(checked) =>
                      toggleNotificationType("notifyOrderUpdate", checked)
                    }
                    aria-label="Aktifkan Notifikasi Update Status Order"
                  />
                </div>

                {/* 4. Peringatan Proses Penting yang Gagal */}
                <div className="flex items-start justify-between p-3.5 rounded-lg border border-border/60 bg-secondary/15 hover:bg-secondary/25 transition-colors gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        Peringatan Proses Penting yang Gagal
                      </span>
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                        Sistem & Diagnostic
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Peringatan darurat bila ada proses kritis backend yang gagal, upload berkas legalitas korup, atau timeout integrasi.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyProsesGagal}
                    onCheckedChange={(checked) =>
                      toggleNotificationType("notifyProsesGagal", checked)
                    }
                    aria-label="Aktifkan Peringatan Proses Gagal"
                  />
                </div>
              </div>

              {/* Action Bar Simpan Settings */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>
                    Terakhir disimpan: {new Date(settings.updatedAt).toLocaleString("id-ID")}
                    {settings.updatedBy ? ` oleh ${settings.updatedBy}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveNotificationSettings}
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center gap-2 shadow-xs"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Menyimpan..." : "Simpan Pengaturan Notifikasi"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Section 3: Status Pengiriman Email (SMTP Diagnostics) */}
          <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Status Pengiriman Email (SMTP Gateway)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Informasi kesiapan server pengirim email dan pengujian koneksi diagnostik.
                    </p>
                  </div>
                </div>

                <Badge
                  variant={smtpStatus.isConfigured ? "default" : "destructive"}
                  className="text-xs py-1 px-2.5 gap-1.5"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${smtpStatus.isConfigured ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                  {smtpStatus.statusText}
                </Badge>
              </div>

              {/* Status Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/15">
                  <span className="text-muted-foreground block mb-1">Server Host SMTP</span>
                  <span className="font-semibold text-foreground">
                    {smtpStatus.host || "Belum Dikonfigurasi di .env"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/15">
                  <span className="text-muted-foreground block mb-1">Port SMTP</span>
                  <span className="font-semibold text-foreground">
                    {smtpStatus.port ? smtpStatus.port : "-"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/15">
                  <span className="text-muted-foreground block mb-1">Alamat Email Pengirim (From)</span>
                  <span className="font-semibold text-foreground truncate block">
                    {smtpStatus.senderEmail || "-"}
                  </span>
                </div>
              </div>

              {/* Status Explanation Banner */}
              {!smtpStatus.isConfigured && (
                <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium mb-0.5">Layanan Pengiriman SMTP Belum Aktif</p>
                    <p className="text-muted-foreground dark:text-amber-300/80 leading-relaxed">
                      Server backend belum memiliki kredensial SMTP aktif (<code className="px-1 py-0.5 bg-muted rounded text-[11px]">SMTP_HOST</code>, <code className="px-1 py-0.5 bg-muted rounded text-[11px]">SMTP_USER</code>, dan <code className="px-1 py-0.5 bg-muted rounded text-[11px]">SMTP_PASS</code> belum diset di file <code className="px-1 py-0.5 bg-muted rounded text-[11px]">.env</code>). Seluruh notifikasi email ditahan secara aman di server untuk mencegah kegagalan aplikasi.
                    </p>
                  </div>
                </div>
              )}

              {/* Test Email Trigger */}
              <div className="space-y-3 pt-2">
                <Label htmlFor="input-test-email" className="text-xs font-medium text-foreground">
                  Uji Coba Pengiriman Email Diagnostik
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="input-test-email"
                    type="email"
                    placeholder={`Tujuan pengujian (default: ${settings.recipientEmails[0] || "penerima utama"})`}
                    value={testTargetEmail}
                    onChange={(e) => setTestTargetEmail(e.target.value)}
                    className="bg-input-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={isTesting}
                    className="shrink-0 flex items-center gap-1.5 border-border"
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isTesting ? "Menguji..." : "Kirim Email Percobaan"}
                  </Button>
                </div>

                {/* Test Feedback Feedback Card */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                      testResult.success
                        ? "border-emerald-300 dark:border-emerald-800 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-red-300 dark:border-red-900/60 bg-red-500/10 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                    )}
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {testResult.success ? "Pengujian Berhasil" : "Hasil Pengujian: Gagal"}
                        </span>
                        <span className="text-[11px] opacity-75">{testResult.timestamp}</span>
                      </div>
                      <p className="leading-relaxed">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Section 4: Riwayat Pengiriman Notifikasi */}
          <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Riwayat Pengiriman Notifikasi
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Log aktivitas pengiriman email notifikasi dan catatan diagnostik sistem.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    fetchLogs();
                    toast.success("Log riwayat notifikasi diperbarui.");
                  }}
                  className="h-8 text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Muat Ulang Riwayat
                </Button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs space-y-1">
                  <Mail className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  <p className="font-medium text-foreground">Belum ada riwayat pengiriman notifikasi</p>
                  <p>Log akan tercatat otomatis saat pengujian email dilakukan atau sistem memicu alert.</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-72 rounded-lg border border-border/60">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 z-10 bg-card border-b border-border/60 font-medium text-muted-foreground shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 bg-card">Waktu</th>
                        <th className="py-2.5 px-3 bg-card">Jenis</th>
                        <th className="py-2.5 px-3 bg-card">Penerima</th>
                        <th className="py-2.5 px-3 bg-card">Judul / Referensi</th>
                        <th className="py-2.5 px-3 bg-card">Status</th>
                        <th className="py-2.5 px-3 bg-card">Keterangan / Diagnostik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {logs.slice(0, 10).map((log) => (
                        <tr key={log.id} className="hover:bg-secondary/15 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground truncate max-w-[150px]">
                            {log.recipient}
                          </td>
                          <td className="py-2.5 px-3 text-foreground truncate max-w-[180px]">
                            {log.title}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {log.status === "BERHASIL" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[10px]">
                                BERHASIL
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                GAGAL
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground max-w-[220px] truncate" title={log.errorMessage || "-"}>
                            {log.errorMessage || "Berhasil dikirim tanpa kendala"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: KEAMANAN AKUN */}
        <TabsContent value="security" className="space-y-6 outline-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Kolom Utama: Form Ganti Kata Sandi */}
            <div className="lg:col-span-7 xl:col-span-8">
              <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          Ganti Kata Sandi Akun
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan sistem.
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-normal w-fit">
                      Wajib Minimal 8 Karakter
                    </Badge>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="old-password" className="text-xs font-medium text-foreground">
                        Kata Sandi Saat Ini
                      </Label>
                      <Input
                        id="old-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Masukkan kata sandi saat ini"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="bg-input-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
                        Kata Sandi Baru
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Minimal 8 karakter kombinasi huruf dan angka"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-input-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-new-password" className="text-xs font-medium text-foreground">
                        Konfirmasi Kata Sandi Baru
                      </Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Ulangi kata sandi baru persis sama"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-input-background"
                      />
                    </div>

                    {/* Persyaratan Kata Sandi Visual Checklist */}
                    <div className="p-3 rounded-lg border border-border/60 bg-secondary/15 space-y-1.5 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground text-[11px] uppercase tracking-wider">
                        Kriteria Kata Sandi yang Kuat:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 8 ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                          <span className={newPassword.length >= 8 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                            Minimal 8 karakter
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${confirmPassword && newPassword === confirmPassword ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                          <span className={confirmPassword && newPassword === confirmPassword ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                            Konfirmasi cocok
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${newPassword && oldPassword && newPassword !== oldPassword ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                          <span className={newPassword && oldPassword && newPassword !== oldPassword ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                            Berbeda dari kata sandi lama
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${/[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword) ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                          <span className={/[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword) ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                            Kombinasi huruf & angka
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">
                      Setelah diperbarui, sesi Anda akan tetap aktif secara otomatis.
                    </p>
                    <Button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="w-full sm:w-auto flex items-center gap-2 shadow-xs"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4" />
                          Perbarui Kata Sandi
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            {/* Kolom Pendukung: 2FA & Kebijakan Keamanan */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-5">
              {/* Card 2FA */}
              <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Autentikasi Dua Faktor (2FA)</h4>
                      <p className="text-[11px] text-muted-foreground">Lapisan perlindungan keamanan ekstra</p>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/15 border border-border/60">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-foreground">Aktifkan Verifikasi OTP</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Minta kode verifikasi OTP setiap login untuk akun level Administrator & Super Admin.
                      </p>
                    </div>
                    <Switch aria-label="Aktifkan autentikasi dua faktor (2FA)" />
                  </div>
                </div>
              </Card>

              {/* Card Panduan Keamanan */}
              <Card className="p-5 border border-border/80 bg-card shadow-xs rounded-xl">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Info className="w-4 h-4 text-primary" />
                    <span>Kebijakan Keamanan Akun</span>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <span>Jangan gunakan kata sandi yang sama dengan akun pribadi lain.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <span>Ganti kata sandi secara berkala setiap 90 hari untuk mitigasi risiko.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <span>Segera lakukan logout setelah selesai menggunakan komputer bersama.</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
