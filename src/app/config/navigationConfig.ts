/**
 * Navigation and Menu Configuration
 * Admin SUN89 — Biro Jasa Management System
 */

import React from "react";
import {
  LayoutDashboard,
  Wallet,
  Database,
  Truck,
  ShoppingCart,
  MapPin,
  Clock,
  TrendingUp,
  MessageSquare,
  CreditCard,
  FileText,
  DollarSign,
  Receipt,
  BarChart3,
  Building2,
  Users,
  Briefcase,
  Activity,
  Shield,
  User,
  AlertCircle,
  History,
  Layers,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: MenuItem[];
}

export const menuItems: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    id: "finance",
    label: "Finance",
    path: "/finance/profit",
    icon: Wallet,
    subItems: [
      { id: "finance-profit", label: "Profit", path: "/finance/profit", icon: TrendingUp },
      { id: "finance-kas-messenger", label: "Kas Messenger", path: "/finance/kas-messenger", icon: MessageSquare },
      { id: "finance-kas-kantor", label: "Kas Kantor", path: "/finance/kas-kantor", icon: Building2 },
      { id: "finance-penjualan", label: "Data Penjualan", path: "/finance/data-penjualan", icon: FileText },
      { id: "finance-belum-bayar", label: "Belum & Kurang Bayar", path: "/finance/belum-bayar", icon: AlertCircle },
      { id: "finance-profit-pending", label: "Profit Terpending", path: "/finance/profit-pending", icon: Clock },
      { id: "finance-cashback-pending", label: "Cashback Terpending", path: "/finance/cashback-pending", icon: DollarSign },
      { id: "finance-laba-rugi", label: "Laba Rugi", path: "/finance/laba-rugi", icon: BarChart3 },
    ],
  },
  {
    id: "master-data",
    label: "Master Data",
    path: "/master-data/samsat",
    icon: Database,
    subItems: [
      { id: "master-layanan", label: "Layanan", path: "/master-data/layanan", icon: Layers },
      { id: "master-samsat", label: "Samsat", path: "/master-data/samsat", icon: Building2 },
      { id: "master-metode-pembayaran", label: "Metode Pembayaran", path: "/master-data/metode-pembayaran", icon: CreditCard },
      { id: "master-biaya-layanan", label: "Biaya Layanan", path: "/master-data/biaya-layanan", icon: DollarSign },
      { id: "master-harga-dasar-samsat", label: "Harga Dasar Samsat", path: "/master-data/harga-dasar", icon: FileText },
    ],
  },
  {
    id: "manajemen",
    label: "Manajemen",
    path: "/manajemen/karyawan",
    icon: Users,
    subItems: [
      { id: "manajemen-karyawan", label: "Karyawan", path: "/manajemen/karyawan", icon: Briefcase },
      { id: "manajemen-pengguna", label: "Pengguna", path: "/manajemen/pengguna", icon: User },
      { id: "access-management", label: "Hak Akses", path: "/manajemen/hak-akses", icon: Shield },
      { id: "audit-log", label: "Riwayat Aktivitas", path: "/manajemen/riwayat-aktivitas", icon: Activity },
    ],
  },
  {
    id: "messenger-menu",
    label: "Messenger",
    path: "/messenger/tasks",
    icon: Truck,
    subItems: [
      { id: "messenger-task", label: "Messenger Task", path: "/messenger/tasks", icon: Truck },
      { id: "messenger-history", label: "Messenger History", path: "/messenger/history", icon: History },
    ],
  },
  {
    id: "order-menu",
    label: "Order",
    path: "/order/buat",
    icon: ShoppingCart,
    subItems: [
      { id: "buat-order", label: "Buat Order", path: "/order/buat", icon: FileText },
      { id: "order-tracking", label: "Order Tracking", path: "/order/tracking", icon: MapPin },
      { id: "order-history", label: "Rekap Order", path: "/order/rekap", icon: Clock },
    ],
  },
];
