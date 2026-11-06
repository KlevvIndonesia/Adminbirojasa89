import React from "react";
import { formatRupiah } from "../../utils/financeFormatters";
import { cn } from "../ui/utils";

export interface FinanceSummaryItem {
  id: string;
  label: string;
  value: number | string;
  isCurrency?: boolean;
  type?: "inflow" | "outflow" | "neutral";
  subtitle?: string;
  tooltip?: string;
}

export interface FinanceSummaryProps {
  items: FinanceSummaryItem[];
  columnsCount?: 2 | 3 | 4;
  className?: string;
}

export function FinanceSummary({
  items,
  columnsCount,
  className,
}: FinanceSummaryProps) {
  // Determine grid column layout based on items length if not explicitly provided
  const cols = columnsCount || (items.length <= 2 ? 2 : items.length === 3 ? 3 : 4);

  const gridColsClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className={cn(
        "grid gap-2.5 sm:gap-3 w-full shrink-0",
        gridColsClass,
        className
      )}
    >
      {items.map((item) => {
        const isNum = typeof item.value === "number";
        const isCurr = item.isCurrency ?? isNum;
        const displayValue = isCurr && isNum ? formatRupiah(item.value as number) : String(item.value);

        const valueColor =
          item.type === "inflow"
            ? "text-emerald-600 dark:text-emerald-400"
            : item.type === "outflow"
              ? "text-rose-600 dark:text-rose-400"
              : "text-foreground";

        return (
          <div
            key={item.id}
            title={item.tooltip}
            className="rounded-lg border border-border bg-card p-2.5 sm:p-3 shadow-2xs transition-colors text-left flex flex-col justify-between min-w-0"
          >
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {item.label}
            </p>
            <div className="mt-1">
              <h4
                className={cn(
                  "text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums truncate",
                  valueColor
                )}
              >
                {displayValue}
              </h4>
              {item.subtitle && (
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
