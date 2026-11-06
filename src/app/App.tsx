import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useLocation, useNavigate, Routes, Route, Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  ShieldAlert,
  ArrowLeft,
  AlertTriangle,
  Check,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Auth } from "./components/Auth";
import { NotificationPopover } from "./components/NotificationPopover";
import { useNotifications } from "./data/notificationAdapter";
import { Button } from "./components/ui/button";
import { NotFoundPage } from "./components/NotFoundPage";
import { HeaderReloadButton } from "./utils/useLiveSync";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./components/ui/dropdown-menu";
import {
  CANONICAL_BIAYA_LAYANAN_SERVICES,
  BIAYA_LAYANAN_ALIAS_MAP,
} from "./components/BiayaLayanan";
import { BIAYA_LAYANAN_SERVICES_MAP } from "./config/routeConfig";
import {
  CANONICAL_SALES_CATEGORIES,
  CANONICAL_SERVICES_METADATA,
} from "./components/DataPenjualan";
import type { CanonicalSalesCategory } from "../domain/finance/types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import {
  NavigationGuardContext,
  CustomHeaderConfig,
  NavigationGuardConfig,
} from "./context/NavigationGuardContext";

// Page-level code splitting for on-demand bundle delivery
const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const Finance = lazy(() => import("./components/Finance").then(m => ({ default: m.Finance })));
const MasterData = lazy(() => import("./components/MasterData").then(m => ({ default: m.MasterData })));
const MessengerTask = lazy(() => import("./components/MessengerTask").then(m => ({ default: m.MessengerTask })));
const MessengerHistory = lazy(() => import("./components/MessengerHistory").then(m => ({ default: m.MessengerHistory })));
const MessengerWorkspace = lazy(() => import("./components/messenger/MessengerWorkspace").then(m => ({ default: m.MessengerWorkspace })));
const BuatOrder = lazy(() => import("./components/BuatOrder").then(m => ({ default: m.BuatOrder })));
const OrderTracking = lazy(() => import("./components/OrderTracking").then(m => ({ default: m.OrderTracking })));
const OrderHistory = lazy(() => import("./components/OrderHistory").then(m => ({ default: m.OrderHistory })));
const SettingsPage = lazy(() => import("./components/Settings").then(m => ({ default: m.Settings })));
const NotificationHistory = lazy(() => import("./components/NotificationHistory").then(m => ({ default: m.NotificationHistory })));
const Profile = lazy(() => import("./components/Profile").then(m => ({ default: m.Profile })));
const AuditLog = lazy(() => import("./components/AuditLog").then(m => ({ default: m.AuditLog })));
const AccessManagement = lazy(() => import("./components/AccessManagement").then(m => ({ default: m.AccessManagement })));

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-xs font-medium">Memuat halaman...</span>
      </div>
    </div>
  );
}

import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import { cn } from "./components/ui/utils";
import { usePermissionStore, permissionStore } from "./data/permissionStore";
import { orderStore } from "./data/orderStore";
import { financeStore } from "./data/financeStore";
import { pricingStore } from "./data/pricingStore";
import { serviceStore, useServiceStore } from "./data/serviceStore";
import { auditLog } from "./utils/auditLog";
import { APP_CONFIG } from "./config/appConfig";
import { menuItems, MenuItem } from "./config/navigationConfig";
import { getRouteMeta } from "./config/routeConfig";

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  useServiceStore();

  // Synchronous initialization from localStorage prevents flash-of-unauth redirect on refresh/deep-link
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem("auth_user") && localStorage.getItem("auth_token"));
    } catch {
      return false;
    }
  });

  const [userRole, setUserRole] = useState<'administrator' | 'finance' | 'admin' | 'messenger' | null>(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.role || null;
      }
    } catch {}
    return null;
  });

  const [userName, setUserName] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.nama || savedUser.name || "";
      }
    } catch {}
    return "";
  });

  const [userId, setUserId] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.userId || String(savedUser.id || "");
      }
    } catch {}
    return "";
  });

  const [employeeId, setEmployeeId] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        const uName = (savedUser.nama || savedUser.name || "").toLowerCase();
        const defaultMsgId = uName.includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001';
        return savedUser.employeeId || (savedUser.role === 'messenger' ? defaultMsgId : '');
      }
    } catch {}
    return "";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([
    "finance",
    "master-data",
    "manajemen",
    "messenger-menu",
    "order-menu"
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { theme } = useTheme();

  // Custom Header & Navigation Guard state (Declared unconditionally at top of component)
  const [customHeader, setCustomHeaderState] = useState<CustomHeaderConfig | null>(null);
  const [navigationGuard, setNavigationGuardState] = useState<NavigationGuardConfig | null>(null);
  const [isNavConfirmOpen, setIsNavConfirmOpen] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  const setCustomHeader = useCallback((action: React.SetStateAction<CustomHeaderConfig | null>) => {
    setCustomHeaderState((prev) => {
      const config = typeof action === "function" ? action(prev) : action;
      if (!prev && !config) return prev;
      if (
        prev &&
        config &&
        prev.title === config.title &&
        prev.subtitle === config.subtitle &&
        prev.showBackButton === config.showBackButton &&
        prev.hideBreadcrumbs === config.hideBreadcrumbs &&
        prev.onBack === config.onBack
      ) {
        return prev;
      }
      return config;
    });
  }, []);

  const setNavigationGuard = useCallback((action: React.SetStateAction<NavigationGuardConfig | null>) => {
    setNavigationGuardState((prev) => {
      const config = typeof action === "function" ? action(prev) : action;
      if (!prev && !config) return prev;
      if (
        prev &&
        config &&
        prev.isDirty === config.isDirty &&
        prev.onDiscard === config.onDiscard
      ) {
        return prev;
      }
      return config;
    });
  }, []);

  const navigationGuardContextValue = useMemo(() => ({
    customHeader,
    setCustomHeader,
    navigationGuard,
    setNavigationGuard,
  }), [customHeader, setCustomHeader, navigationGuard, setNavigationGuard]);

  // Authoritative Role & Permission Store
  const { canViewPage, getFilteredMenuItems } = usePermissionStore();

  // Dynamic notifications derived from real unpaid invoices & active orders
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Accessibility: close mobile sidebar on Escape key
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Verify token on mount and initialize stores if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      handleLogout();
      return;
    }

    // Verify token validity against backend /api/auth/me
    fetch(`${APP_CONFIG.apiBaseUrl}/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleLogout();
        } else if (res.ok) {
          try {
            const payload = await res.json();
            if (payload?.success && payload.data) {
              if (payload.data.role && payload.data.role !== userRole) {
                setUserRole(payload.data.role);
                const savedUserStr = localStorage.getItem("auth_user");
                if (savedUserStr) {
                  try {
                    const saved = JSON.parse(savedUserStr);
                    saved.role = payload.data.role;
                    localStorage.setItem("auth_user", JSON.stringify(saved));
                  } catch {}
                }
              }
            }
          } catch {}

          // Initialize all core stores in parallel with valid token
          Promise.allSettled([
            orderStore.initFromApi(),
            financeStore.initFromApi(),
            pricingStore.initFromApi(),
            serviceStore.initFromApi(),
            auditLog.initFromApi(),
            permissionStore.initFromApi(),
          ]).catch(() => {});
        }
      })
      .catch(() => {
        // Network fallback
        orderStore.initFromApi().catch(() => {});
      });
  }, [isAuthenticated]);

  // Global listener for 401 Unauthorized events from background API requests
  useEffect(() => {
    const onUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener("sun89_auth_unauthorized", onUnauthorized);
    return () => window.removeEventListener("sun89_auth_unauthorized", onUnauthorized);
  }, []);

  const handleLogin = (
    role: 'administrator' | 'finance' | 'admin' | 'messenger',
    name: string,
    id: string,
    empId?: string
  ) => {
    setUserRole(role);
    setUserName(name);
    setUserId(id);
    const defaultMsgId = name?.toLowerCase().includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001';
    const finalEmpId = empId || (role === 'messenger' ? defaultMsgId : '');
    setEmployeeId(finalEmpId);
    setIsAuthenticated(true);

    try {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          role,
          jabatan: role.toUpperCase(),
          nama: name,
          name,
          userId: id,
          id,
          employeeId: finalEmpId,
        })
      );
    } catch {
      // ignore
    }

    // Initialize all core stores in parallel with fresh session
    Promise.allSettled([
      orderStore.initFromApi(),
      financeStore.initFromApi(),
      pricingStore.initFromApi(),
      auditLog.initFromApi(),
      permissionStore.initFromApi(),
    ]).catch(() => {});

    // Target route after login
    const targetPath = (location.state as any)?.from?.pathname || (role === 'messenger' ? '/messenger/workspace' : '/dashboard');
    navigate(targetPath, { replace: true });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setUserRole(null);
    setUserName("");
    setUserId("");
    setEmployeeId("");
    navigate("/login", { replace: true });
  };

  // 1. Unauthenticated Route Flow
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Auth onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }

  // 2. Redirect authenticated users away from /login
  if (location.pathname === "/login") {
    return <Navigate to={userRole === 'messenger' ? '/messenger/workspace' : '/dashboard'} replace />;
  }

  // 3. Dedicated Messenger Workspace for Messenger Role
  if (userRole === 'messenger') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <MessengerWorkspace
          onLogout={handleLogout}
          currentUser={{
            userId,
            userName,
            role: 'messenger',
            employeeId: employeeId || (userName?.toLowerCase().includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001'),
          }}
        />
      </Suspense>
    );
  }

  // 3.5 Immediate Redirect for removed /finance/pengeluaran to /finance/kas-kantor
  if (location.pathname === "/finance/pengeluaran") {
    return <Navigate to="/finance/kas-kantor" replace />;
  }

  // 4. Standard Desktop / Admin Shell
  const filteredMenuItems = getFilteredMenuItems(userRole, menuItems);
  const routeMeta = getRouteMeta(location.pathname);
  const isAllowed = userRole ? canViewPage(userRole, routeMeta.id) : false;

  const isDataPenjualanRoute = location.pathname.startsWith("/finance/data-penjualan");
  const rawPathCat = location.pathname.replace(/^\/finance\/data-penjualan\/?/, "").split("/")[0];
  const activeSalesCategory = (rawPathCat && (CANONICAL_SALES_CATEGORIES as string[]).includes(rawPathCat))
    ? (rawPathCat as CanonicalSalesCategory)
    : "perpanjangan-1-tahun";
  const currentCategoryLabel = CANONICAL_SERVICES_METADATA[activeSalesCategory]?.title || "Perpanjangan 1 Tahun";

  const isBiayaLayananRoute = location.pathname.startsWith("/master-data/biaya-layanan");
  const rawBiayaPathService = location.pathname.replace(/^\/master-data\/biaya-layanan\/?/, "").split("/")[0];
  const activeBiayaServiceKey = (rawBiayaPathService && BIAYA_LAYANAN_ALIAS_MAP[rawBiayaPathService])
    ? BIAYA_LAYANAN_ALIAS_MAP[rawBiayaPathService]
    : (rawBiayaPathService || "perpanjangan-1-tahun");
  const currentBiayaServiceLabel = BIAYA_LAYANAN_SERVICES_MAP[activeBiayaServiceKey] || "Perpanjangan 1 Tahun";


  const handleNavigate = (path: string) => {
    if (navigationGuard?.isDirty && path !== location.pathname) {
      setPendingNavPath(path);
      setIsNavConfirmOpen(true);
      return;
    }
    navigate(path);
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  };

  const handleConfirmLeave = () => {
    setIsNavConfirmOpen(false);
    if (pendingNavPath === "__BACK__") {
      navigationGuard?.onDiscard?.();
      setCustomHeader(null);
      setNavigationGuard(null);
      customHeader?.onBack?.();
    } else if (pendingNavPath) {
      navigationGuard?.onDiscard?.();
      setCustomHeader(null);
      setNavigationGuard(null);
      navigate(pendingNavPath);
      if (isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    }
    setPendingNavPath(null);
  };

  const handleCancelLeave = () => {
    setIsNavConfirmOpen(false);
    setPendingNavPath(null);
  };

  return (
    <NavigationGuardContext.Provider value={navigationGuardContextValue}>
      <div className="flex h-screen h-[100dvh] max-h-screen w-full overflow-hidden overscroll-none bg-background">
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden"
            />
            {/* Sidebar */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi utama"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] glass-sidebar z-50 lg:hidden flex flex-col"
            >
              <SidebarContent 
                isSidebarOpen={true}
                currentPath={location.pathname}
                onNavigate={handleNavigate}
                handleLogout={handleLogout}
                expandedMenus={expandedMenus}
                setExpandedMenus={setExpandedMenus}
                filteredMenuItems={filteredMenuItems}
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 280 : 80,
        }}
        className="glass-sidebar hidden lg:flex flex-col relative z-30 transition-all duration-300 shrink-0 h-full max-h-screen overflow-visible"
      >
        <SidebarContent 
          isSidebarOpen={isSidebarOpen}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
          handleLogout={handleLogout}
          expandedMenus={expandedMenus}
          setExpandedMenus={setExpandedMenus}
          filteredMenuItems={filteredMenuItems}
        />

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={isSidebarOpen ? "Kecilkan menu samping" : "Perluas menu samping"}
          aria-expanded={isSidebarOpen}
          className="hidden lg:flex absolute -right-3 top-5 w-6 h-6 items-center justify-center rounded-full bg-card border border-border shadow-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all z-40 cursor-pointer"
        >
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isSidebarOpen ? "rotate-180" : "")} />
        </button>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border/80 px-3 sm:px-4 py-2.5 md:px-6 md:py-3 flex items-center justify-between shrink-0 shadow-xs z-10 gap-2 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={isMobileSidebarOpen}
              className="lg:hidden h-8 w-8 p-0 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </Button>

            {customHeader?.showBackButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (navigationGuard?.isDirty) {
                    setPendingNavPath("__BACK__");
                    setIsNavConfirmOpen(true);
                  } else {
                    customHeader.onBack?.();
                  }
                }}
                className="flex items-center gap-1.5 border-border hover:bg-secondary/50 text-xs h-8 sm:h-9 px-2.5 sm:px-3 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                <span>Kembali</span>
              </Button>
            )}

            <div className="min-w-0 flex-1">
              <div className="text-sm md:text-base leading-tight font-semibold text-foreground truncate flex items-center gap-1.5">
                {customHeader?.title ? (
                  customHeader.title
                ) : isDataPenjualanRoute ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Data Penjualan -</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 py-0.5"
                          title="Pilih layanan Data Penjualan"
                        >
                          <span>{currentCategoryLabel}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-card border-border shadow-md">
                        {CANONICAL_SALES_CATEGORIES.map((catKey) => {
                          const meta = CANONICAL_SERVICES_METADATA[catKey];
                          const isSelected = activeSalesCategory === catKey;
                          return (
                            <DropdownMenuItem
                              key={catKey}
                              onSelect={() => handleNavigate(`/finance/data-penjualan/${catKey}`)}
                              onClick={() => handleNavigate(`/finance/data-penjualan/${catKey}`)}
                              className={cn(
                                "cursor-pointer text-xs font-medium py-2 px-2.5 flex items-center justify-between",
                                isSelected && "bg-primary/10 text-primary font-bold"
                              )}
                            >
                              <span>{meta.title}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : isBiayaLayananRoute ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Biaya Layanan -</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 py-0.5"
                          title="Pilih layanan Biaya Layanan"
                        >
                          <span>{currentBiayaServiceLabel}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-card border-border shadow-md">
                        {CANONICAL_BIAYA_LAYANAN_SERVICES.map((svc) => {
                          const isSelected = activeBiayaServiceKey === svc.key;
                          return (
                            <DropdownMenuItem
                              key={svc.key}
                              onSelect={() => handleNavigate(`/master-data/biaya-layanan/${svc.key}`)}
                              onClick={() => handleNavigate(`/master-data/biaya-layanan/${svc.key}`)}
                              className={cn(
                                "cursor-pointer text-xs font-medium py-2 px-2.5 flex items-center justify-between",
                                isSelected && "bg-primary/10 text-primary font-bold"
                              )}
                            >
                              <span>{svc.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  routeMeta.title
                )}
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
                {customHeader?.subtitle || (isDataPenjualanRoute ? `Rekapitulasi transaksi ${currentCategoryLabel} dan kalkulasi Samsat` : isBiayaLayananRoute ? `Katalog tarif resmi dan biaya jasa untuk ${currentBiayaServiceLabel}` : routeMeta.description)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Realtime Live Sync Indicator & Reload Button */}
            <HeaderReloadButton
              variant="admin"
              toastMessage="Data order & status operasional diperbarui"
            />
            <ThemeToggle />
            <NotificationPopover
              open={isNotificationOpen}
              onOpenChange={setIsNotificationOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
            >
              <Button
                variant="ghost"
                size="sm"
                className="relative h-8 w-8 p-0 shrink-0"
                aria-label={`Notifikasi sistem${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ""}`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 min-w-4 h-4 p-0 flex items-center justify-center bg-rose-500 text-white text-[10px] font-semibold rounded-full px-1 border-0">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </NotificationPopover>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate("/settings")}
              aria-label="Pengaturan sistem"
              className="hidden sm:flex h-8 w-8 p-0 shrink-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <button
              type="button"
              className="flex items-center gap-2 pl-1.5 sm:pl-2.5 md:pl-3 border-l border-border/80 cursor-pointer hover:bg-muted/60 rounded-lg px-1.5 py-1 sm:px-2 transition-colors shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => handleNavigate("/profile")}
              aria-label="Buka profil admin"
            >
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-xs font-medium text-foreground leading-tight">{userName || "Admin"}</p>
                <p className="text-[11px] text-muted-foreground">{userRole ? userRole.toUpperCase() : "Admin"}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Breadcrumb Bar (Below Header - No border line, compact spacing) */}
        {!customHeader?.hideBreadcrumbs && routeMeta.breadcrumbs && routeMeta.breadcrumbs.length > 1 && (
          <div className="px-3 sm:px-4 pt-2 pb-0 md:px-6 shrink-0 flex items-center">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground truncate">
              {routeMeta.breadcrumbs.map((crumb, idx) => {
                const isLast = idx === routeMeta.breadcrumbs.length - 1;
                return (
                  <span key={crumb} className="inline-flex items-center gap-1.5">
                    {idx > 0 && <span className="opacity-40">/</span>}
                    <span className={cn(isLast ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {crumb}
                    </span>
                  </span>
                );
              })}
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto overscroll-contain min-w-0 w-full">
          <ErrorBoundary
            resetKey={location.pathname}
            fallbackTitle={`Terjadi kendala saat memuat ${routeMeta.title}`}
            onReset={() => navigate("/dashboard")}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <div className={cn(
                "min-h-full w-full min-w-0 animate-in fade-in duration-150 text-left flex flex-col page-shell",
                routeMeta.breadcrumbs && routeMeta.breadcrumbs.length > 1 && "pt-1.5 sm:pt-2 md:pt-2.5"
              )}>
                {!isAllowed && routeMeta.id !== "unknown" ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                    >
                      Kembali ke Dashboard
                    </Button>
                  </div>
                ) : (
                  <Routes>
                    {/* Root Redirect */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* Main Dashboard */}
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Finance Routes */}
                    <Route path="/finance/profit" element={<Finance defaultTab="profit" />} />
                    <Route path="/finance/kas-messenger" element={<Finance defaultTab="kas-messenger" />} />
                    <Route path="/finance/kas-kantor" element={<Finance defaultTab="kas-kantor" />} />
                    <Route path="/finance/pengeluaran" element={<Navigate to="/finance/kas-kantor" replace />} />
                    <Route path="/finance/data-penjualan" element={<Navigate to="/finance/data-penjualan/perpanjangan-1-tahun" replace />} />
                    <Route path="/finance/data-penjualan/:category" element={<Finance defaultTab="penjualan" />} />
                    <Route path="/finance/belum-bayar" element={<Finance defaultTab="belum-bayar" />} />
                    <Route path="/finance/profit-pending" element={<Finance defaultTab="profit-pending" />} />
                    <Route path="/finance/cashback-pending" element={<Finance defaultTab="cashback-pending" />} />
                    <Route path="/finance/tagihan" element={<Navigate to="/finance/belum-bayar" replace />} />
                    <Route path="/finance/laba-rugi" element={<Finance defaultTab="laba-rugi" />} />

                    {/* Master Data Routes */}
                    <Route path="/master-data/layanan" element={<MasterData defaultTab="layanan" />} />
                    <Route path="/master-data/samsat" element={<MasterData defaultTab="samsat" />} />
                    <Route path="/master-data/metode-pembayaran" element={<MasterData defaultTab="metode-pembayaran" />} />
                    <Route path="/master-data/biaya-layanan" element={<MasterData defaultTab="biaya-layanan" />} />
                    <Route path="/master-data/biaya-layanan/:service" element={<MasterData defaultTab="biaya-layanan" />} />
                    <Route path="/master-data/harga-dasar" element={<MasterData defaultTab="harga-dasar-samsat" />} />

                    {/* Management Routes */}
                    <Route path="/manajemen/karyawan" element={<MasterData defaultTab="karyawan" />} />
                    <Route path="/manajemen/pengguna" element={<MasterData defaultTab="pengguna" />} />
                    <Route path="/manajemen/hak-akses" element={<AccessManagement currentUserId={userId} currentUserName={userName} />} />
                    <Route path="/manajemen/riwayat-aktivitas" element={<AuditLog currentUserRole={userRole || 'admin'} />} />

                    {/* Messenger Tasks & History (Admin View) */}
                    <Route path="/messenger/tasks" element={<MessengerTask />} />
                    <Route path="/messenger/history" element={<MessengerHistory />} />
                    <Route path="/messenger/workspace" element={<MessengerWorkspace onLogout={handleLogout} currentUser={{ userId, userName, role: userRole || 'admin', employeeId }} />} />

                    {/* Order Routes */}
                    <Route path="/order/buat" element={
                      <BuatOrder 
                        onOrderCreated={() => navigate("/order/tracking")} 
                        currentUserName={userName} 
                        currentUserRole={userRole || "admin"} 
                        currentUserId={userId} 
                      />
                    } />
                    <Route path="/order/tracking" element={<OrderTracking userRole={userRole} userName={userName} userId={userId} />} />
                    <Route path="/order/rekap" element={<OrderHistory />} />

                    {/* Utility Routes */}
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/notifikasi" element={<NotificationHistory />} />
                    <Route path="/profile" element={<Profile />} />

                    {/* 404 Catch-All */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>

    {/* Global Navigation Guard Confirmation Dialog */}
    <AlertDialog open={isNavConfirmOpen} onOpenChange={setIsNavConfirmOpen}>
      <AlertDialogContent className="border-border sm:max-w-md bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            Tinggalkan Halaman?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Perubahan data transaksi yang Anda masukkan belum disimpan. Jika Anda meninggalkan halaman ini sekarang, semua perubahan yang Anda masukkan akan hilang.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-between sm:justify-between w-full">
          <Button
            size="sm"
            variant="outline"
            className="h-8.5 text-xs font-medium"
            onClick={handleCancelLeave}
          >
            Batal
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
            onClick={handleConfirmLeave}
          >
            Tinggalkan Halaman
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </NavigationGuardContext.Provider>
  );
}

function SidebarContent({ 
  isSidebarOpen, 
  currentPath, 
  onNavigate,
  handleLogout,
  expandedMenus,
  setExpandedMenus,
  filteredMenuItems,
  onClose
}: { 
  isSidebarOpen: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  handleLogout: () => void;
  expandedMenus: string[];
  setExpandedMenus: (menus: string[]) => void;
  filteredMenuItems: MenuItem[];
  onClose?: () => void;
}) {
  const toggleMenu = (menuId: string) => {
    if (expandedMenus.includes(menuId)) {
      setExpandedMenus(expandedMenus.filter(id => id !== menuId));
    } else {
      setExpandedMenus([...expandedMenus, menuId]);
    }
  };

  const isItemActive = (path: string) => {
    if (path === "/finance/data-penjualan") {
      return currentPath.startsWith("/finance/data-penjualan");
    }
    if (path === "/dashboard") {
      return currentPath === "/dashboard" || currentPath === "/";
    }
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const isParentActive = (item: MenuItem) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.some(sub => isItemActive(sub.path));
    }
    return isItemActive(item.path);
  };

  return (
    <>
      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between">
          <motion.div
            animate={{ opacity: isSidebarOpen ? 1 : 0 }}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              <span>BJ</span>
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight truncate">
                  Admin SUN89
                </h1>
                <p className="text-[11px] text-muted-foreground font-normal truncate">Biro Jasa System</p>
              </div>
            )}
          </motion.div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Tutup menu navigasi"
              className="lg:hidden h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isParentActive(item);
          const isExpanded = expandedMenus.includes(item.id);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          
          return (
            <div key={item.id}>
              {/* Main Menu Item */}
              <motion.button
                onClick={() => {
                  if (hasSubItems) {
                    toggleMenu(item.id);
                    if (!isExpanded && isSidebarOpen) {
                      onNavigate(item.subItems![0].path);
                    }
                  } else {
                    onNavigate(item.path);
                  }
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors relative group text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 relative z-10", isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground")} />
                {isSidebarOpen && (
                  <>
                    <span className={cn("relative z-10 flex-1 text-left truncate", isActive ? "text-primary dark:text-blue-400" : "text-foreground/80 group-hover:text-foreground")}>
                      {item.label}
                    </span>
                    {hasSubItems && (
                      <ChevronDown 
                        className={cn(
                          "w-4 h-4 transition-transform relative z-10 shrink-0", 
                          isExpanded ? "rotate-180" : "",
                          isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground"
                        )} 
                      />
                    )}
                  </>
                )}
              </motion.button>

              {/* Sub Menu Items */}
              {hasSubItems && isSidebarOpen && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                        {item.subItems!.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = isItemActive(subItem.path);

                          return (
                            <motion.button
                              key={subItem.id}
                              onClick={() => onNavigate(subItem.path)}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs relative",
                                isSubActive
                                  ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-400 font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <SubIcon className={cn("w-3.5 h-3.5 flex-shrink-0", isSubActive ? "text-primary dark:text-blue-400" : "text-muted-foreground")} />
                              <span className={cn("truncate", isSubActive ? "text-primary dark:text-blue-400" : "text-foreground/75")}>
                                {subItem.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="px-3 py-3 border-t border-border/80 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm transition-colors",
            !isSidebarOpen && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {isSidebarOpen && <span>Logout</span>}
        </Button>
      </div>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={toggleTheme}
      className="relative"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Terjadi kendala pada sistem Admin SUN89">
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
