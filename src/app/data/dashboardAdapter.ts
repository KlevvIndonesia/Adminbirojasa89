/**
 * Dashboard Adapter & Selectors
 * Derives operational and financial metrics strictly from OrderStore and FinanceStore
 * Admin SUN89 — Biro Jasa Management System
 */

import { OperationalOrder, StageName, STAGES } from "../../domain/order/types";
import { InvoiceBillingRecord, KasKantorItem, ProfitItem } from "../../domain/finance/types";
import { AuditLogEntry } from "../utils/auditLog";
import { isFullyPaid } from "../../domain/finance/paymentMapping";

export interface DashboardStats {
  berkasAktifCount: number;
  totalClientCount: number;
  taskPendingCount: number;
  totalOrderCount: number;
  orderSelesaiCount: number;
  revenueTotal: number;
  outstandingTotal: number;
  realizedProfitTotal: number;
  saldoKasKantor: number;
}

export interface ServiceDistributionItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface MonthlyTrendItem {
  name: string;
  profit: number;
  orders: number;
}

export interface CalendarReminderItem {
  id: string;
  date: Date;
  type: "payment" | "pickup" | "delivery" | "salary";
  title: string;
  client?: string;
  messenger?: string;
  department?: string;
  location?: string;
  amount?: string;
  orderNo?: string;
}

export interface DashboardActivityItem {
  id: string;
  type: "success" | "pending" | "warning";
  message: string;
  time: string;
  rawDate?: Date;
}

/**
 * Parse standard or Indonesian dates safely without throwing
 */
export function parseDateSafe(dateInput?: string | Date): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  const str = String(dateInput).trim();

  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split("T")[0].split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or D/M/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split("/").map(Number);
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format relative time in Indonesian without fake hardcoded timestamps
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculates operational KPIs from OrderStore
 */
export function getOperationalKPIs(
  activeOrders: Record<StageName, OperationalOrder[]>,
  archivedOrders: OperationalOrder[]
) {
  let activeCount = 0;
  const stageCounts: Record<StageName, number> = {
    "Verifikasi": 0,
    "Penjadwalan": 0,
    "Verifikasi Dokumen": 0,
    "Proses Samsat": 0,
    "Verifikasi Ulang": 0,
    "Supervisi": 0,
    "Pengantaran": 0,
    "Dokumen Telah Diterima": 0,
  };

  const clientSet = new Set<string>();

  for (const stage of STAGES) {
    const orders = activeOrders[stage] || [];
    stageCounts[stage] = orders.length;
    activeCount += orders.length;
    orders.forEach((o) => {
      if (o.customer) clientSet.add(o.customer.trim().toLowerCase());
    });
  }

  archivedOrders.forEach((o) => {
    if (o.customer) clientSet.add(o.customer.trim().toLowerCase());
  });

  // Pending tasks: orders awaiting assignment, in verification, or with pending status
  let pendingTasksCount = 0;
  for (const stage of STAGES) {
    for (const order of activeOrders[stage] || []) {
      if (
        order.currentStep <= 2 &&
        (!order.messenger || order.messenger === "Belum Ditugaskan")
      ) {
        pendingTasksCount++;
      } else if (order.messengerTaskStatus === "Pending") {
        pendingTasksCount++;
      }
    }
  }

  const orderSelesaiCount = (activeOrders["Dokumen Telah Diterima"]?.length || 0) + archivedOrders.length;
  const totalOrderCount = activeCount + archivedOrders.length;

  return {
    activeOrdersCount: activeCount,
    totalOrderCount,
    orderSelesaiCount,
    totalClientCount: clientSet.size,
    pendingTasksCount,
    stageCounts,
  };
}

/**
 * Calculates active orders matching a given timeframe filter
 */
export function getBerkasCountByFilter(
  activeOrders: Record<StageName, OperationalOrder[]>,
  filter: "hari" | "minggu" | "bulan" | "tahun"
): number {
  let allActive: OperationalOrder[] = [];
  for (const stage of STAGES) {
    allActive = allActive.concat(activeOrders[stage] || []);
  }

  if (filter === "tahun") {
    return allActive.length;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return allActive.filter((o) => {
    const d = parseDateSafe(o.createdAt);
    if (!d) return true; // if date unparsed, count as active

    if (filter === "hari") return d >= startOfDay;
    if (filter === "minggu") return d >= startOfWeek;
    if (filter === "bulan") return d >= startOfMonth;
    return true;
  }).length;
}

/**
 * Calculates financial KPIs from FinanceStore
 */
export function getFinancialKPIs(
  invoices: InvoiceBillingRecord[],
  kasKantor: KasKantorItem[],
  profitData: ProfitItem[]
) {
  let revenueTotal = 0;
  let outstandingTotal = 0;

  invoices.forEach((inv) => {
    // Exclude cancelled invoices/orders from revenue and outstanding totals
    const rawInv = inv as unknown as Record<string, unknown>;
    if (
      inv.status === "CANCELLED" ||
      rawInv.status === "Dibatalkan" ||
      inv.billingStatus === "CANCELLED" ||
      rawInv.billingStatus === "Dibatalkan" ||
      Boolean(rawInv.isCancelled)
    ) {
      return;
    }

    revenueTotal += inv.terbayar || 0;
    if (!isFullyPaid(inv.status)) {
      outstandingTotal += inv.sisa || 0;
    }
  });

  const saldoKasKantor = kasKantor.length > 0 ? kasKantor[kasKantor.length - 1].total : 0;
  const realizedProfitTotal = profitData.reduce((sum, p) => sum + (p.profit || 0), 0);

  return {
    revenueTotal,
    outstandingTotal,
    realizedProfitTotal,
    saldoKasKantor,
  };
}

/**
 * Computes Service Distribution from real active & archived orders
 */
export function getServiceDistribution(
  activeOrders: Record<StageName, OperationalOrder[]>,
  archivedOrders: OperationalOrder[]
): ServiceDistributionItem[] {
  let perpanjanganCount = 0;
  let balikNamaCount = 0;
  let mutasiCount = 0;
  let lainnyaCount = 0;

  const countOrder = (order: OperationalOrder) => {
    const s = (order.layanan || "").toLowerCase();
    if (s.includes("perpanjang") || s.includes("stnk")) {
      perpanjanganCount++;
    } else if (s.includes("balik nama") || s.includes("bbn")) {
      balikNamaCount++;
    } else if (s.includes("mutasi")) {
      mutasiCount++;
    } else {
      lainnyaCount++;
    }
  };

  for (const stage of STAGES) {
    (activeOrders[stage] || []).forEach(countOrder);
  }
  archivedOrders.forEach(countOrder);

  const total = perpanjanganCount + balikNamaCount + mutasiCount + lainnyaCount;

  if (total === 0) {
    return [
      { name: "Perpanjang STNK", value: 0, count: 0, color: "#3b82f6" },
      { name: "Balik Nama", value: 0, count: 0, color: "#60a5fa" },
      { name: "Mutasi", value: 0, count: 0, color: "#93c5fd" },
      { name: "Lainnya", value: 0, count: 0, color: "#1d4ed8" },
    ];
  }

  return [
    {
      name: "Perpanjang STNK",
      value: Math.round((perpanjanganCount / total) * 100),
      count: perpanjanganCount,
      color: "#3b82f6",
    },
    {
      name: "Balik Nama",
      value: Math.round((balikNamaCount / total) * 100),
      count: balikNamaCount,
      color: "#60a5fa",
    },
    {
      name: "Mutasi",
      value: Math.round((mutasiCount / total) * 100),
      count: mutasiCount,
      color: "#93c5fd",
    },
    {
      name: "Lainnya",
      value: Math.round((lainnyaCount / total) * 100),
      count: lainnyaCount,
      color: "#1d4ed8",
    },
  ];
}

/**
 * Computes Monthly Trend from real orders & profit data
 * Builds 6 rolling month buckets
 */
export function getMonthlyTrend(
  activeOrders: Record<StageName, OperationalOrder[]>,
  archivedOrders: OperationalOrder[],
  profitData: ProfitItem[]
): MonthlyTrendItem[] {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  
  // Construct 6-month window ending with current month
  const now = new Date();
  const buckets: { year: number; month: number; name: string; profit: number; orders: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      name: monthNames[d.getMonth()],
      profit: 0,
      orders: 0,
    });
  }

  // Aggregate orders by creation month
  const tallyOrder = (order: OperationalOrder) => {
    const d = parseDateSafe(order.createdAt);
    if (!d) return;
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) {
      bucket.orders++;
    }
  };

  for (const stage of STAGES) {
    (activeOrders[stage] || []).forEach(tallyOrder);
  }
  archivedOrders.forEach(tallyOrder);

  // Aggregate realized profits by transaction month
  profitData.forEach((p) => {
    const d = parseDateSafe(p.tanggal);
    if (!d) return;
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) {
      bucket.profit += p.profit || 0;
    }
  });

  return buckets.map((b) => ({
    name: b.name,
    profit: b.profit,
    orders: b.orders,
  }));
}

/**
 * Derives Calendar Reminders from real operational stages and unpaid invoices
 */
export function getCalendarReminders(
  activeOrders: Record<StageName, OperationalOrder[]>,
  invoices: InvoiceBillingRecord[]
): CalendarReminderItem[] {
  const reminders: CalendarReminderItem[] = [];

  // 1. Unpaid invoices needing payment reminder
  invoices
    .filter((inv) => !isFullyPaid(inv.status) && inv.billingStatus !== "COMPLETED")
    .forEach((inv) => {
      const d = parseDateSafe(inv.jatuhTempo || inv.tanggal);
      if (d) {
        reminders.push({
          id: `pay-${inv.id}`,
          date: d,
          type: "payment",
          title: inv.status === "Kurang Bayar" ? "Pelunasan Tagihan (Kurang Bayar)" : "Tagihan Belum Lunas",
          client: inv.customer,
          amount: `Rp ${(inv.sisa || 0).toLocaleString("id-ID")}`,
          orderNo: inv.orderNo || inv.invoice,
        });
      }
    });

  // 2. Scheduled Pickups (Stage 2/3)
  const pickupOrders = (activeOrders["Penjadwalan"] || []).concat(activeOrders["Verifikasi Dokumen"] || []);
  pickupOrders.forEach((o) => {
    const d = parseDateSafe(o.tanggalJemput || o.createdAt);
    if (d) {
      reminders.push({
        id: `pickup-${o.orderNo}`,
        date: d,
        type: "pickup",
        title: "Jadwal Penjemputan Dokumen",
        messenger: o.messenger || "Belum Ditugaskan",
        location: o.alamatPenjemputan?.detail || o.alamatPenjemputan?.kota || o.wilayahSamsatAsal || "Jakarta",
        orderNo: o.orderNo,
      });
    }
  });

  // 3. Scheduled Deliveries (Stage 7/8)
  const deliveryOrders = (activeOrders["Pengantaran"] || []).concat(activeOrders["Dokumen Telah Diterima"] || []);
  deliveryOrders.forEach((o) => {
    const d = parseDateSafe(o.tanggalPengantaran || o.tanggalDiterima || o.createdAt);
    if (d) {
      reminders.push({
        id: `deliv-${o.orderNo}`,
        date: d,
        type: "delivery",
        title: o.currentStep === 8 ? "Dokumen Telah Diterima Klien" : "Jadwal Pengantaran Dokumen",
        messenger: o.messengerPengantar || o.messenger || "Belum Ditugaskan",
        location: o.alamatPengantaran?.detail || o.alamatPengantaran?.kota || o.wilayahSamsatAsal || "Jakarta",
        orderNo: o.orderNo,
      });
    }
  });

  return reminders;
}

/**
 * Filter reminders for a specific selected date
 */
export function getRemindersForDate(
  reminders: CalendarReminderItem[],
  selectedDate?: Date
): CalendarReminderItem[] {
  if (!selectedDate) return [];
  const targetYear = selectedDate.getFullYear();
  const targetMonth = selectedDate.getMonth();
  const targetDay = selectedDate.getDate();

  return reminders.filter((r) => {
    return (
      r.date.getFullYear() === targetYear &&
      r.date.getMonth() === targetMonth &&
      r.date.getDate() === targetDay
    );
  });
}

/**
 * Check if a date has any reminders
 */
export function hasRemindersForDate(reminders: CalendarReminderItem[], date: Date): boolean {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();

  return reminders.some(
    (r) =>
      r.date.getFullYear() === targetYear &&
      r.date.getMonth() === targetMonth &&
      r.date.getDate() === targetDay
  );
}

/**
 * Derives Recent Activities from AuditLog (authoritative source of real system activities)
 */
export function getRecentActivities(
  auditLogs: AuditLogEntry[],
  activeOrders?: Record<StageName, OperationalOrder[]>,
  invoices?: InvoiceBillingRecord[]
): DashboardActivityItem[] {
  // Map real audit logs to Dashboard activities
  return auditLogs.slice(0, 5).map((log) => {
    const actionUpper = (log.action || "").toUpperCase();
    const type: "success" | "pending" | "warning" =
      actionUpper === "CREATE" || actionUpper === "APPROVE" || actionUpper === "ARCHIVE"
        ? "success"
        : actionUpper === "UPDATE"
        ? "pending"
        : "warning";

    return {
      id: `audit-${log.id}`,
      type,
      message: `${log.module}: ${log.details}`,
      time: formatRelativeTime(log.timestamp),
      rawDate: log.timestamp,
    };
  });
}
