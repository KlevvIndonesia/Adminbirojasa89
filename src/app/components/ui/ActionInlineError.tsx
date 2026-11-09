import React from "react";
import { AlertCircle, RefreshCw, ShieldAlert, WifiOff, Clock, X } from "lucide-react";
import { ClassifiedActionError, classifyActionError } from "../../utils/actionErrorClassifier";
import { cn } from "./utils";

export interface ActionInlineErrorProps {
  error?: ClassifiedActionError | string | null;
  actionKey?: string;
  className?: string;
  compact?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

/**
 * Compact, accessible inline error feedback rendered directly adjacent to the triggered button
 * or dialog footer. Wraps safely on desktop/mobile widths without overflowing containers.
 */
export function ActionInlineError({
  error,
  actionKey,
  className,
  compact = false,
  onDismiss,
  onRetry,
  isRetrying = false,
}: ActionInlineErrorProps) {
  if (!error) return null;

  const normalized: ClassifiedActionError =
    typeof error === "string"
      ? classifyActionError({ message: error })
      : error;

  const isAuthOrRule =
    normalized.code === "FORBIDDEN" ||
    normalized.code === "UNAUTHORIZED" ||
    normalized.code === "BUSINESS_RULE_VIOLATION";
  const isNetworkOrTimeout =
    normalized.code === "NETWORK_ERROR" || normalized.code === "TIMEOUT";

  const Icon =
    normalized.code === "NETWORK_ERROR"
      ? WifiOff
      : normalized.code === "TIMEOUT"
      ? Clock
      : isAuthOrRule
      ? ShieldAlert
      : AlertCircle;

  const toneClasses = isAuthOrRule
    ? "border-amber-300/80 bg-amber-50/90 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
    : isNetworkOrTimeout
    ? "border-blue-300/80 bg-blue-50/90 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200"
    : "border-rose-300/80 bg-rose-50/95 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200";

  return (
    <div
      role="alert"
      aria-live="polite"
      data-action-error={actionKey || "action"}
      data-error-code={normalized.code}
      className={cn(
        "rounded-md border text-left shadow-xs transition-all",
        compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
        toneClasses,
        className
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Icon className={cn("shrink-0 mt-0.5", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        <div className="flex-1 min-w-0 whitespace-normal break-words leading-snug">
          {!compact && normalized.title && (
            <p className="font-semibold leading-tight mb-0.5">{normalized.title}</p>
          )}
          <p className={cn("leading-snug", compact ? "font-medium" : "opacity-95")}>
            {normalized.message}
          </p>
          {onRetry && normalized.isRetryable && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={onRetry}
              className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-background/80 hover:bg-background border border-current/20 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-2.5 h-2.5", isRetrying && "animate-spin")} />
              {isRetrying ? "Mencoba Ulang..." : "Coba Lagi"}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup pesan error"
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
