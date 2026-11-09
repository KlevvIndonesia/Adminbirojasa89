import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  User,
  Truck,
  AlertCircle,
  Clock,
  WifiOff,
  ServerCrash,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "./ui/alert-dialog";

import { userRepository, AuthErrorCode } from "../../data/repositories/userRepository";

interface AuthProps {
  onLogin: (role: 'administrator' | 'finance' | 'admin' | 'messenger', userName: string, userId: string, employeeId?: string) => void;
}

interface AuthFeedbackState {
  title: string;
  message: string;
  type: AuthErrorCode;
  retryAfterSeconds?: number;
}

export function Auth({ onLogin }: AuthProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inlineError, setInlineError] = useState<AuthFeedbackState | null>(null);
  const [dialogError, setDialogError] = useState<AuthFeedbackState | null>(null);

  const credentials = userRepository.getDemoCredentials();

  const clearErrors = () => {
    if (inlineError) setInlineError(null);
    if (dialogError) setDialogError(null);
  };

  const handleSelectDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    clearErrors();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submission

    const cleanEmail = email.trim();

    // Client-side validation: empty credentials
    if (!cleanEmail || !password) {
      const title = "Autentikasi Gagal";
      const message = "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.";
      const state: AuthFeedbackState = { title, message, type: "VALIDATION_ERROR" };
      setInlineError(state);
      setDialogError(state);
      toast.error(message);
      return;
    }

    // Client-side validation: basic email structure
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      const title = "Autentikasi Gagal";
      const message = "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.";
      const state: AuthFeedbackState = { title, message, type: "INVALID_CREDENTIALS" };
      setInlineError(state);
      setDialogError(state);
      toast.error(message);
      return;
    }

    setIsLoading(true);
    setInlineError(null);
    setDialogError(null);

    try {
      const result = await userRepository.authenticateDetailed(cleanEmail, password);

      if (result.success && result.session) {
        setInlineError(null);
        setDialogError(null);

        const roleLabel =
          result.session.role === "administrator"
            ? "Administrator"
            : result.session.role === "finance"
            ? "Finance"
            : result.session.role === "messenger"
            ? `Messenger (${result.session.name})`
            : "Admin";

        toast.success(`Login berhasil sebagai ${roleLabel}!`);
        onLogin(result.session.role, result.session.name, result.session.userId, result.session.employeeId);
        return;
      }

      // Determine mapped failure feedback
      const errorCode: AuthErrorCode = result.errorCode || "INVALID_CREDENTIALS";
      let title = "Autentikasi Gagal";
      let message = result.errorMessage || "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.";

      switch (errorCode) {
        case "ACCOUNT_INACTIVE":
          title = "Akses Akun Dinonaktifkan";
          message = "Akun Anda belum aktif atau aksesnya telah dinonaktifkan. Hubungi administrator.";
          break;
        case "TOO_MANY_REQUESTS":
          title = "Batas Percobaan Terlampaui";
          message = "Terlalu banyak percobaan login. Silakan tunggu sebelum mencoba kembali.";
          break;
        case "NETWORK_ERROR":
        case "TIMEOUT_ERROR":
          title = "Koneksi Terputus";
          message = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
          break;
        case "SERVER_ERROR":
          title = "Gangguan Server";
          message = "Terjadi gangguan pada layanan login. Silakan coba kembali beberapa saat lagi.";
          break;
        case "UNEXPECTED_ERROR":
          title = "Terjadi Kendala Sistem";
          message = "Terjadi kendala saat memproses permintaan login. Silakan coba kembali.";
          break;
        case "INVALID_CREDENTIALS":
        case "VALIDATION_ERROR":
        default:
          title = "Autentikasi Gagal";
          message = "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.";
          break;
      }

      const feedback: AuthFeedbackState = {
        title,
        message,
        type: errorCode,
        retryAfterSeconds: result.retryAfterSeconds,
      };

      setInlineError(feedback);
      setDialogError(feedback);
      toast.error(message);
    } catch (unhandledErr: any) {
      // Safely log client exception without sensitive user data (email/password/token)
      console.error(
        "[Auth] Unhandled client login exception:",
        unhandledErr instanceof Error ? unhandledErr.message : "Client exception"
      );

      const fallback: AuthFeedbackState = {
        title: "Terjadi Kendala Sistem",
        message: "Terjadi kendala saat memproses permintaan login. Silakan coba kembali.",
        type: "UNEXPECTED_ERROR",
      };

      setInlineError(fallback);
      setDialogError(fallback);
      toast.error(fallback.message);
    } finally {
      // Restore submit button to normal state so the user can retry
      setIsLoading(false);
    }
  };

  const getDialogIcon = (type?: AuthErrorCode) => {
    switch (type) {
      case "ACCOUNT_INACTIVE":
        return (
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
        );
      case "TOO_MANY_REQUESTS":
        return (
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        );
      case "NETWORK_ERROR":
      case "TIMEOUT_ERROR":
        return (
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-6 h-6" />
          </div>
        );
      case "SERVER_ERROR":
        return (
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ServerCrash className="w-6 h-6" />
          </div>
        );
      case "UNEXPECTED_ERROR":
        return (
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      case "INVALID_CREDENTIALS":
      case "VALIDATION_ERROR":
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="p-4 sm:p-6 md:p-8 border border-border shadow-sm bg-card">
          {/* Logo/Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-3 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Biro Jasa System
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Sistem Administrasi Operasional SUN89</p>
          </motion.div>

          {/* Login Form */}
          <div className="space-y-5">
            <form onSubmit={handleLogin} className="space-y-3.5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@email.com"
                    className="pl-10 bg-input-background border-border"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    required
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-input-background border-border"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrors();
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center text-sm"
              >
                <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer select-none">
                  <input id="remember-me" type="checkbox" className="rounded border-border text-primary" />
                  <span className="text-muted-foreground text-xs">Ingat saya</span>
                </label>
              </motion.div>

              {/* Inline Form Feedback */}
              {inlineError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert variant="destructive" className="py-2.5 px-3">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <AlertTitle className="text-xs font-semibold">{inlineError.title}</AlertTitle>
                    <AlertDescription className="text-xs text-rose-600 dark:text-rose-300">
                      {inlineError.message}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    "Masuk ke Sistem"
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Demo Credentials Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-5 pt-5 border-t border-border"
            >
              <p className="text-xs text-muted-foreground text-center mb-3">Demo Credentials</p>
              <div className="grid grid-cols-2 gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectDemo(credentials.administrator.email, credentials.administrator.password)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectDemo(credentials.administrator.email, credentials.administrator.password);
                    }
                  }}
                  aria-label="Pilih akun demo Admin SVP"
                  className="p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Badge status="role">Admin (SVP)</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{credentials.administrator.email}</p>
                  <p className="text-[11px] text-muted-foreground">{credentials.administrator.password}</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectDemo(credentials.finance.email, credentials.finance.password)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectDemo(credentials.finance.email, credentials.finance.password);
                    }
                  }}
                  aria-label="Pilih akun demo Finance"
                  className="p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Badge status="role">Finance</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{credentials.finance.email}</p>
                  <p className="text-[11px] text-muted-foreground">{credentials.finance.password}</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectDemo(credentials.admin.email, credentials.admin.password)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectDemo(credentials.admin.email, credentials.admin.password);
                    }
                  }}
                  aria-label="Pilih akun demo Admin Loket"
                  className="p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Badge status="role">Admin</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{credentials.admin.email}</p>
                  <p className="text-[11px] text-muted-foreground">{credentials.admin.password}</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectDemo(credentials.messenger1.email, credentials.messenger1.password)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectDemo(credentials.messenger1.email, credentials.messenger1.password);
                    }
                  }}
                  aria-label="Pilih akun demo Messenger Budi"
                  className="p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Badge status="role">Msg: Budi</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{credentials.messenger1.email}</p>
                  <p className="text-[11px] text-muted-foreground">{credentials.messenger1.password}</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectDemo(credentials.messenger2.email, credentials.messenger2.password)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectDemo(credentials.messenger2.email, credentials.messenger2.password);
                    }
                  }}
                  aria-label="Pilih akun demo Messenger Andi"
                  className="p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors col-span-2 text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <Badge status="role">Msg: Andi Pratama</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{credentials.messenger2.email}</p>
                  <p className="text-[11px] text-muted-foreground">{credentials.messenger2.password}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </Card>
      </motion.div>

      {/* Alert Dialog Error Popup */}
      <AlertDialog
        open={!!dialogError}
        onOpenChange={(open) => {
          if (!open) setDialogError(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {getDialogIcon(dialogError?.type)}
            <div className="space-y-1.5 flex-1">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base sm:text-lg font-semibold text-foreground">
                  {dialogError?.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
                  {dialogError?.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {dialogError?.retryAfterSeconds && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-1 font-medium">
                  Silakan tunggu sekitar {dialogError.retryAfterSeconds} detik sebelum mencoba kembali.
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter className="mt-4 sm:mt-2">
            <AlertDialogAction
              onClick={() => setDialogError(null)}
              className="w-full sm:w-auto"
            >
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
