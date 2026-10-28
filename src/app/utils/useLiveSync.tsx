/**
 * Realtime Live Sync & Header Reload Utility
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides:
 * 1. LiveSyncManager: Singleton service handling heartbeat polling (8s), tab focus sync,
 *    and cross-tab sync via BroadcastChannel / localStorage.
 * 2. useLiveSync: React hook for observing sync state and triggering manual refresh.
 * 3. LiveSyncBadge & HeaderReloadButton: Reusable accessible UI components for Admin & Messenger headers.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RotateCw, RotateCcw, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../components/ui/utils";
import { toast } from "sonner";
import { orderStore } from "../data/orderStore";
import { financeRepository } from "../../data/repositories/financeRepository";
import { resolveApiBaseUrl } from "../config/appConfig";

export type LiveSyncStatus = "connected" | "syncing" | "offline" | "error";

interface SyncEventPayload {
  type: "MUTATION_PULSE" | "MANUAL_PULSE";
  senderId: string;
  timestamp: number;
}

// Generate unique identifier for current browser tab session
const CLIENT_TAB_ID = typeof window !== "undefined"
  ? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  : "tab_server";

const SYNC_CHANNEL_NAME = "sun89_order_sync";
const STORAGE_SYNC_KEY = "sun89_sync_pulse";
const HEARTBEAT_INTERVAL_MS = 8000; // 8 seconds background polling
const MIN_FOCUS_SYNC_DELAY_MS = 3000; // 3 seconds debounce for tab focus sync

class LiveSyncManager {
  private status: LiveSyncStatus = "connected";
  private lastSyncedAt: Date = new Date();
  private isSyncing = false;
  private error: string | null = null;
  private listeners: Set<() => void> = new Set();
  private channel: BroadcastChannel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private inFlightSync: Promise<boolean> | null = null;
  private lastPulseTimestamp = 0;
  
  // Guard flag: prevents re-broadcasting when receiving an external sync
  public isReceivingRemotePulse = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initCrossTabChannel();
      this.initWindowEvents();
      this.startHeartbeat();
    }
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("LiveSyncManager listener error:", err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot() {
    return {
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      isSyncing: this.isSyncing,
      error: this.error,
    };
  }

  private initCrossTabChannel() {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncEventPayload>) => {
          this.handleIncomingPulse(event.data);
        };
      }
    } catch {
      // BroadcastChannel unsupported or blocked
      this.channel = null;
    }

    // Storage fallback for cross-tab communication
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_SYNC_KEY && e.newValue) {
        try {
          const payload: SyncEventPayload = JSON.parse(e.newValue);
          this.handleIncomingPulse(payload);
        } catch {}
      }
    });
  }

  private handleIncomingPulse(payload?: SyncEventPayload) {
    if (!payload || payload.senderId === CLIENT_TAB_ID) return;
    
    // Remote mutation detected from another tab
    this.isReceivingRemotePulse = true;
    this.sync({ silent: true })
      .finally(() => {
        // Reset guard on next microtask
        setTimeout(() => {
          this.isReceivingRemotePulse = false;
        }, 100);
      });
  }

  public broadcastMutationPulse() {
    if (this.isReceivingRemotePulse) return;

    const now = Date.now();
    // Throttle duplicate pulses within 300ms
    if (now - this.lastPulseTimestamp < 300) return;
    this.lastPulseTimestamp = now;

    const payload: SyncEventPayload = {
      type: "MUTATION_PULSE",
      senderId: CLIENT_TAB_ID,
      timestamp: now,
    };

    try {
      if (this.channel) {
        this.channel.postMessage(payload);
      }
    } catch {}

    try {
      localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(payload));
    } catch {}
  }

  private async checkLiveness(): Promise<boolean> {
    try {
      // Prefer same-origin proxy /api first in browser
      const url = typeof window !== "undefined" && window.location?.origin
        ? "/api/health/live"
        : `${resolveApiBaseUrl()}/health/live`;
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {}

    try {
      const baseUrl = resolveApiBaseUrl();
      const res = await fetch(`${baseUrl}/health/live`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  private initWindowEvents() {
    // Tab Focus & Visibility Change: instant sync on return
    const handleReturnToApp = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - this.lastSyncedAt.getTime();
        if (elapsed > MIN_FOCUS_SYNC_DELAY_MS) {
          this.sync({ silent: true });
        }
      }
    };

    window.addEventListener("focus", handleReturnToApp);
    document.addEventListener("visibilitychange", handleReturnToApp);

    // Online / Offline detection
    window.addEventListener("online", () => {
      this.checkLiveness().then((alive) => {
        if (alive) {
          this.status = "connected";
          this.error = null;
          this.notify();
          this.sync({ silent: true });
        }
      });
    });

    window.addEventListener("offline", async () => {
      const isAlive = await this.checkLiveness();
      if (!isAlive) {
        this.status = "offline";
        this.error = "Koneksi backend terputus";
        this.notify();
      }
    });

    // Cross-tab broadcast trigger on local store mutation
    window.addEventListener("sun89_order_mutated", () => {
      this.broadcastMutationPulse();
    });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // Initial sync
    this.sync({ silent: true });

    this.heartbeatTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        this.sync({ silent: true });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Authoritative sync method
   * Runs orderStore.refresh and financeRepository.initFromApi
   */
  public async sync(options?: {
    silent?: boolean;
    showToast?: boolean;
    message?: string;
  }): Promise<boolean> {
    const isSilent = options?.silent ?? false;
    const showToast = options?.showToast ?? false;
    const toastMsg = options?.message || "Data operasional & tugas berhasil diperbarui";

    // If already in flight, return ongoing promise
    if (this.inFlightSync) {
      return this.inFlightSync;
    }

    this.isSyncing = true;
    if (!isSilent) {
      this.status = "syncing";
    }
    this.notify();

    const minSpinnerTime = isSilent ? 0 : 500;
    const startTime = Date.now();

    this.inFlightSync = (async () => {
      try {
        const isBackendLive = await this.checkLiveness();
        if (!isBackendLive) {
          this.status = "offline";
          this.error = "Server backend tidak merespon";
          this.notify();
          return false;
        }

        let isMessengerUser = false;
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            const raw = window.localStorage.getItem("auth_user");
            if (raw) {
              const u = JSON.parse(raw);
              if (u.role === "messenger") isMessengerUser = true;
            }
          }
        } catch {}

        // Parallel sync of Order and Finance domains (couriers only sync order domain, never finance)
        await Promise.allSettled([
          typeof (orderStore as any)?.refresh === "function"
            ? (orderStore as any).refresh(isSilent)
            : typeof (orderStore as any)?.initFromApi === "function"
              ? (orderStore as any).initFromApi()
              : Promise.resolve(),
          (!isMessengerUser && typeof (financeRepository as any)?.initFromApi === "function")
            ? (financeRepository as any).initFromApi()
            : Promise.resolve(),
        ]);

        // Ensure minimum visual feedback time for manual reload
        const elapsed = Date.now() - startTime;
        if (elapsed < minSpinnerTime) {
          await new Promise((res) => setTimeout(res, minSpinnerTime - elapsed));
        }

        this.lastSyncedAt = new Date();
        this.status = "connected";
        this.error = null;

        if (showToast) {
          toast.success(toastMsg, {
            description: `Diperbarui pada ${this.lastSyncedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
            duration: 2500,
          });
        }
        return true;
      } catch (err: any) {
        console.error("LiveSync error:", err);
        this.status = "offline";
        this.error = err?.message || "Gagal menyinkronkan data";
        if (showToast) {
          toast.error("Gagal menyinkronkan data", {
            description: "Mempertahankan data lokal yang tersedia.",
          });
        }
        return false;
      } finally {
        this.isSyncing = false;
        this.inFlightSync = null;
        this.notify();
      }
    })();

    return this.inFlightSync;
  }
}

// Global singleton instance
export const liveSyncManager = new LiveSyncManager();

/**
 * Convenience helper to broadcast a mutation pulse to other tabs
 */
export function broadcastMutationPulse() {
  liveSyncManager.broadcastMutationPulse();
}

/**
 * Format relative time ago in Indonesian
 */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "Baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/**
 * React Hook for Live Synchronization
 */
export function useLiveSync() {
  const [snapshot, setSnapshot] = useState(() => liveSyncManager.getSnapshot());
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(snapshot.lastSyncedAt));

  useEffect(() => {
    const unsubscribe = liveSyncManager.subscribe(() => {
      const current = liveSyncManager.getSnapshot();
      setSnapshot(current);
      setTimeAgo(formatTimeAgo(current.lastSyncedAt));
    });

    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(liveSyncManager.getSnapshot().lastSyncedAt));
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const refreshNow = useCallback(
    (options?: { showToast?: boolean; message?: string }) => {
      return liveSyncManager.sync({
        silent: false,
        showToast: options?.showToast ?? true,
        message: options?.message,
      });
    },
    []
  );

  return {
    ...snapshot,
    timeAgo,
    refreshNow,
  };
}

/**
 * Visual Live Sync Status Indicator Badge
 */
export function LiveSyncBadge({
  status,
  lastSyncedAt,
  showLabel = true,
  className,
}: {
  status: LiveSyncStatus;
  lastSyncedAt: Date;
  showLabel?: boolean;
  className?: string;
}) {
  const formattedTime = lastSyncedAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const tooltipText =
    status === "connected"
      ? `Realtime Live Sync Aktif • Terakhir diperbarui ${formattedTime} (Auto-sync setiap 8 dtk)`
      : status === "syncing"
      ? "Sedang menyinkronkan data terbaru..."
      : status === "offline"
      ? "Mode Offline • Menampilkan cache lokal"
      : `Kendala Sinkronisasi • Terakhir ${formattedTime}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all select-none cursor-default border",
            status === "connected" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
            status === "syncing" && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
            status === "offline" && "bg-muted text-muted-foreground border-border",
            status === "error" && "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
            className
          )}
        >
          {status === "connected" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          {status === "syncing" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-spin relative inline-flex rounded-full h-2 w-2 border-2 border-amber-500 border-t-transparent"></span>
            </span>
          )}
          {status === "offline" && (
            <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/60"></span>
          )}
          {status === "error" && (
            <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}

          {showLabel && (
            <span className="font-semibold text-[10px] tracking-wide">
              {status === "connected" ? "LIVE" : status === "syncing" ? "SYNC" : "OFFLINE"}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

interface HeaderReloadButtonProps {
  variant?: "admin" | "messenger";
  toastMessage?: string;
  showLiveBadge?: boolean;
  className?: string;
}

/**
 * Universal Header Reload Button with Live Sync Indicator
 * Fits seamlessly in both Admin Header and Messenger Workspace
 */
export function HeaderReloadButton({
  variant = "admin",
  toastMessage,
  showLiveBadge = true,
  className,
}: HeaderReloadButtonProps) {
  const { isSyncing, status, lastSyncedAt, refreshNow } = useLiveSync();

  const handleReload = () => {
    refreshNow({
      showToast: true,
      message:
        toastMessage ||
        (variant === "messenger"
          ? "Kondisi tugas operasional diperbarui"
          : "Data order & status operasional diperbarui"),
    });
  };

  const formattedTime = lastSyncedAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (variant === "messenger") {
    return (
      <div className={cn("flex items-center gap-1.5 shrink-0", className)}>
        {showLiveBadge && (
          <LiveSyncBadge
            status={status}
            lastSyncedAt={lastSyncedAt}
            className="hidden sm:inline-flex"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReload}
              disabled={isSyncing}
              aria-label="Perbarui data tugas terkini"
              className={cn(
                "h-10 px-3 sm:px-3.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/80 hover:border-primary/40 text-foreground transition-all flex items-center gap-1.5 shadow-2xs font-medium text-xs touch-manipulation min-h-[44px]",
                isSyncing && "opacity-80 cursor-wait"
              )}
            >
              <RotateCw
                className={cn(
                  "w-4 h-4 text-primary shrink-0 transition-transform",
                  isSyncing && "animate-spin text-primary"
                )}
              />
              <span className="hidden sm:inline font-semibold">Reload</span>
              <span className="sm:hidden font-semibold">Update</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Klik untuk memperbarui kondisi task dan data terkini (Terakhir {formattedTime})
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Admin Header Variant
  return (
    <div className={cn("flex items-center gap-1 sm:gap-1.5 shrink-0", className)}>
      {showLiveBadge && (
        <LiveSyncBadge
          status={status}
          lastSyncedAt={lastSyncedAt}
          className="hidden md:inline-flex mr-0.5"
        />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={isSyncing}
            aria-label="Muat ulang dan sinkronkan data terkini"
            className={cn(
              "h-8 px-2 sm:px-2.5 rounded-lg border-border/80 bg-card/60 hover:bg-muted/70 hover:border-primary/40 text-foreground text-xs font-medium transition-all flex items-center gap-1.5",
              isSyncing && "opacity-80 cursor-wait"
            )}
          >
            <RotateCcw
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-colors",
                isSyncing && "animate-spin text-primary"
              )}
            />
            <span className="hidden lg:inline text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              Reload
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Muat ulang data order & operasional terkini (Terakhir {formattedTime})
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
