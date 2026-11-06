import React, { useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  Filter, 
  X, 
  FileQuestion,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  SlidersHorizontal,
  Download,
  FileText,
  Printer,
  Loader2,
  Check,
  Car,
  CreditCard,
  User,
  AlertTriangle,
  Save
} from "lucide-react";
import {
  exportToCSV,
  exportToPDF,
  filterDataByExportPeriod,
  ExportPeriodOption,
  ExportColumn,
} from "../utils/financeExport";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import { cn } from "./ui/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { 
  formatDateDDMMYYYY, 
  parseDateTimestamp,
  formatRupiah, 
  PlateNumberBadge, 
  PlainTextStatus,
  formatCustomerName,
  formatBerkasName
} from "../utils/financeFormatters";
import { 
  FinanceDateFilter, 
  FinanceDateFilterValue, 
  getWeekRange 
} from "./FinanceDateFilter";
import { PlateNumberInput } from "./PlateNumberInput";
import { SearchableSamsatSelect } from "./SearchableSamsatSelect";

export interface Column {
  key: string;
  label: string;
  filterable?: boolean;
  filterType?: "text" | "select" | "date";
  filterOptions?: string[];
  align?: "left" | "right";
  isPrimaryMobile?: boolean; // True for the 2 primary columns on mobile
  render?: (value: any, item?: any) => React.ReactNode;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "plate-number" | "samsat-select";
  options?: string[];
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  helpText?: string;
}

interface EnhancedTableWithDialogsProps {
  columns: Column[];
  data: any[];
  onAdd?: () => void;
  onEdit?: (item: any, updatedData: any) => void;
  onDelete?: (item: any) => void;
  onView?: (item: any) => void;
  onPrint?: (item: any) => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  searchPlaceholder?: string;
  itemsPerPageOptions?: number[];
  editFields?: FieldConfig[];
  hideAddButton?: boolean;
  hideEditButton?: boolean;
  hideDeleteButton?: boolean;
  bypassInternalDeleteDialog?: boolean;
  bypassInternalEditDialog?: boolean;
  subTabTitle?: string;
  suppressTrailingActionColumn?: boolean;
  serverPageOffset?: number;
  renderBottom?: (context: { filteredData: any[]; sortedData: any[]; totalItems: number }) => React.ReactNode;
  onFilteredDataChange?: (filteredData: any[]) => void;
  tableContainerClassName?: string;
}

type SortDirection = "asc" | "desc" | null;

export function EnhancedTableWithDialogs({
  columns,
  data,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onPrint,
  onExport,
  searchPlaceholder = "Cari nama / nopol...",
  itemsPerPageOptions = [10, 25, 50, 100],
  editFields,
  hideAddButton = false,
  hideEditButton = false,
  hideDeleteButton = false,
  bypassInternalDeleteDialog = false,
  bypassInternalEditDialog = false,
  subTabTitle,
  suppressTrailingActionColumn = false,
  serverPageOffset,
  renderBottom,
  onFilteredDataChange,
  tableContainerClassName,
}: EnhancedTableWithDialogsProps) {
  // Search inputs (Requirement 12: separate date and text searches)
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<FinanceDateFilterValue | null>(null);

  // Export modal state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriodOption>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  // Desktop Table Settings Persistence (survives F5 refresh)
  const storageKey = useMemo(() => {
    const safeTitle = (subTabTitle || "default_table").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    return `sun89_table_settings_${safeTitle}`;
  }, [subTabTitle]);

  const loadPersistedSettings = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return null;
  }, [storageKey]);

  const savedSettings = loadPersistedSettings();

  const [itemsPerPage, setItemsPerPage] = useState(() => {
    if (savedSettings?.itemsPerPage && itemsPerPageOptions.includes(savedSettings.itemsPerPage)) {
      return savedSettings.itemsPerPage;
    }
    return itemsPerPageOptions.includes(25) ? 25 : itemsPerPageOptions[0];
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Sorting state (Requirement 10 & 11)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Desktop Table Settings: Saved & Draft Font size & column visibility (Explicit Save Model)
  const [savedTableFontSize, setSavedTableFontSize] = useState<"1x" | "2x" | "3x">(() => {
    if (savedSettings?.tableFontSize && ["1x", "2x", "3x"].includes(savedSettings.tableFontSize)) {
      return savedSettings.tableFontSize;
    }
    return "1x";
  });

  const [savedVisibleColumnKeys, setSavedVisibleColumnKeys] = useState<Set<string>>(() => {
    const allColKeys = new Set(columns.map((c) => c.key));
    if (Array.isArray(savedSettings?.visibleColumns) && savedSettings.visibleColumns.length > 0) {
      const validKeys = savedSettings.visibleColumns.filter((k: string) => allColKeys.has(k));
      if (validKeys.length > 0) {
        return new Set(validKeys);
      }
    }
    return allColKeys;
  });

  // Settings Popover Open State & Draft States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftTableFontSize, setDraftTableFontSize] = useState<"1x" | "2x" | "3x">(savedTableFontSize);
  const [draftVisibleColumnKeys, setDraftVisibleColumnKeys] = useState<Set<string>>(() => new Set(savedVisibleColumnKeys));

  // Determine if draft differs from saved configuration
  const hasUnsavedFontSize = draftTableFontSize !== savedTableFontSize;
  const hasUnsavedColumns = useMemo(() => {
    if (draftVisibleColumnKeys.size !== savedVisibleColumnKeys.size) return true;
    for (const key of draftVisibleColumnKeys) {
      if (!savedVisibleColumnKeys.has(key)) return true;
    }
    return false;
  }, [draftVisibleColumnKeys, savedVisibleColumnKeys]);
  const hasUnsavedSettings = hasUnsavedFontSize || hasUnsavedColumns;

  // Persist table settings helper
  const persistTableSettings = useCallback((cols: Set<string>, fontSize: "1x" | "2x" | "3x", perPage: number) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const payload = {
          visibleColumns: Array.from(cols),
          tableFontSize: fontSize,
          itemsPerPage: perPage,
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      }
    } catch {}
  }, [storageKey]);

  // Handle opening/closing of Settings Popover
  const handleSettingsOpenChange = (open: boolean) => {
    if (open) {
      // Saat menu dibuka kembali, tampilkan pengaturan terakhir yang tersimpan
      setDraftTableFontSize(savedTableFontSize);
      setDraftVisibleColumnKeys(new Set(savedVisibleColumnKeys));
    } else {
      // Pastikan perubahan draft yang dibatalkan tidak menggantikan konfigurasi tersimpan
      setDraftTableFontSize(savedTableFontSize);
      setDraftVisibleColumnKeys(new Set(savedVisibleColumnKeys));
    }
    setIsSettingsOpen(open);
  };

  // Synchronize visibleColumnKeys when columns prop updates or when subTabTitle changes
  const prevSubTabRef = React.useRef(subTabTitle);
  const prevColumnsKeyStrRef = React.useRef(columns.map((c) => c.key).join(","));

  React.useEffect(() => {
    const currentKeysStr = columns.map((c) => c.key).join(",");
    const subTabChanged = prevSubTabRef.current !== subTabTitle;
    const columnsChanged = prevColumnsKeyStrRef.current !== currentKeysStr;

    if (!subTabChanged && !columnsChanged) {
      return;
    }

    prevSubTabRef.current = subTabTitle;
    prevColumnsKeyStrRef.current = currentKeysStr;

    if (subTabChanged) {
      const saved = loadPersistedSettings();
      const allKeys = new Set(columns.map((c) => c.key));
      let initialKeys = allKeys;
      if (Array.isArray(saved?.visibleColumns) && saved.visibleColumns.length > 0) {
        const valid = saved.visibleColumns.filter((k: string) => allKeys.has(k));
        if (valid.length > 0) {
          initialKeys = new Set(valid);
        }
      }
      setSavedVisibleColumnKeys(initialKeys);
      setDraftVisibleColumnKeys(new Set(initialKeys));

      const initialFont = (saved?.tableFontSize && ["1x", "2x", "3x"].includes(saved.tableFontSize)) ? saved.tableFontSize : "1x";
      setSavedTableFontSize(initialFont);
      setDraftTableFontSize(initialFont);

      if (saved?.itemsPerPage && itemsPerPageOptions.includes(saved.itemsPerPage)) {
        setItemsPerPage(saved.itemsPerPage);
      }
      return;
    }

    if (columnsChanged) {
      setSavedVisibleColumnKeys((prev) => {
        const currentKeys = new Set(columns.map((c) => c.key));
        if (prev.size === 0) return currentKeys;
        const next = new Set<string>();
        columns.forEach((c) => {
          if (prev.has(c.key)) next.add(c.key);
        });
        const resolved = (next.size <= 1 && columns.length > 2) ? currentKeys : (next.size > 0 ? next : currentKeys);
        setDraftVisibleColumnKeys(new Set(resolved));
        return resolved;
      });
    }
  }, [subTabTitle, columns, loadPersistedSettings, itemsPerPageOptions]);

  const handleSaveTableSettings = () => {
    setSavedTableFontSize(draftTableFontSize);
    setSavedVisibleColumnKeys(new Set(draftVisibleColumnKeys));
    persistTableSettings(draftVisibleColumnKeys, draftTableFontSize, itemsPerPage);
    toast.success("Pengaturan tabel berhasil disimpan");
    setIsSettingsOpen(false);
  };

  const handleResetTableSettings = () => {
    const allKeys = new Set(columns.map((c) => c.key));
    setDraftVisibleColumnKeys(new Set(allKeys));
    setDraftTableFontSize("1x");
    setSavedVisibleColumnKeys(new Set(allKeys));
    setSavedTableFontSize("1x");
    const defaultPerPage = itemsPerPageOptions.includes(25) ? 25 : itemsPerPageOptions[0];
    setItemsPerPage(defaultPerPage);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(storageKey);
      }
    } catch {}
    toast.success("Pengaturan tabel dikembalikan ke default");
  };

  const isDraftAllColumnsVisible = draftVisibleColumnKeys.size === columns.length;
  const isDraftSomeColumnsVisible = draftVisibleColumnKeys.size > 0 && draftVisibleColumnKeys.size < columns.length;
  const draftSelectAllState: boolean | "indeterminate" = isDraftAllColumnsVisible ? true : (isDraftSomeColumnsVisible ? "indeterminate" : false);

  const handleDraftToggleSelectAll = () => {
    if (isDraftAllColumnsVisible) {
      setDraftVisibleColumnKeys(new Set());
    } else {
      setDraftVisibleColumnKeys(new Set(columns.map((c) => c.key)));
    }
  };

  const handleDraftToggleColumn = (key: string) => {
    const next = new Set(draftVisibleColumnKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setDraftVisibleColumnKeys(next);
  };

  // Structured filter columns (Requirements 4 & 5: Pengurusan, Rekening, and dropdown categories)
  // Free text search fields (nopol, customer, invoice, etc.) are excluded because they belong in the toolbar search.
  const structuredFilterColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.filterable) return false;
      const lower = col.key.toLowerCase();
      if (
        lower.includes("nopol") || 
        lower.includes("plat") || 
        lower.includes("customer") || 
        lower.includes("invoice") || 
        lower.includes("nama") ||
        lower.includes("keterangan") ||
        lower.includes("alasan")
      ) {
        return false;
      }
      if (lower.includes("tanggal") || lower.includes("tgl") || lower.includes("tempo")) {
        return false;
      }
      return true;
    });
  }, [columns]);

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<string>("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  const isEditFormDirty = useMemo(() => {
    if (!initialEditSnapshot) return false;
    return JSON.stringify(editFormData) !== initialEditSnapshot;
  }, [editFormData, initialEditSnapshot]);

  const handleCancelEdit = () => {
    if (isEditFormDirty) {
      setIsDiscardDialogOpen(true);
    } else {
      setIsEditDialogOpen(false);
    }
  };

  const handleConfirmDiscardEdit = () => {
    setIsDiscardDialogOpen(false);
    setIsEditDialogOpen(false);
  };

  // Contextual identifier for delete confirmation
  const itemIdentifier = useMemo(() => {
    if (!selectedItem) return "transaksi ini";
    if (selectedItem.customer) {
      return `${selectedItem.customer}${selectedItem.nopol ? ` (${selectedItem.nopol})` : ""}`;
    }
    if (selectedItem.keterangan) return selectedItem.keterangan;
    if (selectedItem.invoice || selectedItem.invoiceNo) return selectedItem.invoice || selectedItem.invoiceNo;
    if (selectedItem.nama) return selectedItem.nama;
    if (selectedItem.orderNo) return `Order ${selectedItem.orderNo}`;
    return "transaksi ini";
  }, [selectedItem]);

  // Check if date column exists
  const hasDateColumn = useMemo(() => {
    return columns.some(c => {
      const k = c.key.toLowerCase();
      return k.includes("tanggal") || k.includes("tgl") || k.includes("tempo");
    });
  }, [columns]);

  // Identify the 2 primary columns for mobile (Requirement 18 & 26)
  const mobilePrimaryColumns = useMemo(() => {
    const specified = columns.filter(c => c.isPrimaryMobile);
    if (specified.length >= 2) return specified.slice(0, 2);

    // Auto-detect: first date/id column + first name/entity column
    const dateCol = columns.find(c => {
      const k = c.key.toLowerCase();
      return k.includes("tanggal") || k.includes("tgl");
    }) || columns[0];

    const descriptorCol = columns.find(c => {
      const k = c.key.toLowerCase();
      return (
        k !== dateCol.key &&
        (k.includes("customer") ||
         k.includes("nama") ||
         k.includes("keterangan") ||
         k.includes("transaksi") ||
         k.includes("nopol") ||
         k.includes("jenis"))
      );
    }) || columns[1] || columns[0];

    return [dateCol, descriptorCol];
  }, [columns]);

  const mobilePrimaryKeys = useMemo(() => {
    return new Set(mobilePrimaryColumns.map(c => c.key));
  }, [mobilePrimaryColumns]);

  // Handle column sorting toggle
  const handleSortToggle = (colKey: string) => {
    if (sortKey !== colKey) {
      setSortKey(colKey);
      setSortDirection("asc");
    } else {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    }
  };

  // Filter and search data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Text Search (nama, nopol, etc.) with space/punctuation tolerance
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const normQuery = query.replace(/[^a-z0-9]/g, "");
        const matchesQuery = Object.entries(item).some(([k, val]) => {
          if (val === null || val === undefined) return false;
          // Don't match internal ids
          if (k === "id") return false;
          const strVal = String(val).toLowerCase();
          if (strVal.includes(query)) return true;
          if (normQuery.length >= 2) {
            const normVal = strVal.replace(/[^a-z0-9]/g, "");
            if (normVal.includes(normQuery)) return true;
          }
          return false;
        });
        if (!matchesQuery) return false;
      }

      // 2. Date Filter (Calendar-based: Hari, Minggu, Bulan, Tahun - Requirements 4-10)
      if (dateFilter) {
        const matchesDate = Object.entries(item).some(([k, val]) => {
          const lowerK = k.toLowerCase();
          if (lowerK.includes("tanggal") || lowerK.includes("tgl") || lowerK.includes("tempo")) {
            const ts = parseDateTimestamp(String(val));
            if (!ts) return false;
            const itemDate = new Date(ts);

            if (dateFilter.mode === "hari" && dateFilter.selectedDate) {
              return (
                itemDate.getFullYear() === dateFilter.selectedDate.getFullYear() &&
                itemDate.getMonth() === dateFilter.selectedDate.getMonth() &&
                itemDate.getDate() === dateFilter.selectedDate.getDate()
              );
            }

            if (dateFilter.mode === "minggu" && dateFilter.selectedDate) {
              const { start, end } = getWeekRange(dateFilter.selectedDate);
              return itemDate >= start && itemDate <= end;
            }

            if (dateFilter.mode === "bulan" && dateFilter.selectedMonth !== undefined && dateFilter.selectedYear !== undefined) {
              return (
                itemDate.getFullYear() === dateFilter.selectedYear &&
                itemDate.getMonth() === dateFilter.selectedMonth
              );
            }

            if (dateFilter.mode === "tahun" && dateFilter.selectedYear !== undefined) {
              return itemDate.getFullYear() === dateFilter.selectedYear;
            }
          }
          return false;
        });
        if (!matchesDate) return false;
      }

      // 3. Column Dropdown Filters
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value || value === "all" || value === "Semua") return true;
        const colDef = columns.find(c => c.key === key);
        if (colDef?.filterType === "select") {
          return String(item[key]).toLowerCase() === value.toLowerCase();
        }
        const rawItemVal = String(item[key] ?? "").toLowerCase();
        const rawFilterVal = value.toLowerCase().trim();
        if (rawItemVal.includes(rawFilterVal)) return true;
        const normFilter = rawFilterVal.replace(/[^a-z0-9]/g, "");
        if (normFilter.length >= 2) {
          return rawItemVal.replace(/[^a-z0-9]/g, "").includes(normFilter);
        }
        return false;
      });

      return matchesFilters;
    });
  }, [data, searchTerm, dateFilter, filters]);

  const prevEmittedRef = React.useRef<any[]>([]);
  React.useEffect(() => {
    if (!onFilteredDataChange) return;
    const prev = prevEmittedRef.current;
    if (
      prev.length === filteredData.length &&
      prev.every((item, i) => item === filteredData[i] || (item && item.id !== undefined && item.id === filteredData[i]?.id))
    ) {
      return;
    }
    prevEmittedRef.current = filteredData;
    onFilteredDataChange(filteredData);
  }, [filteredData, onFilteredDataChange]);

  // Sorted data (Requirement 10 & 11)
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData;

    const lowerKey = sortKey.toLowerCase();
    const isDate = lowerKey.includes("tanggal") || lowerKey.includes("tgl") || lowerKey.includes("tempo");

    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      // Date sort using numeric timestamp (Requirement 10)
      if (isDate) {
        const timeA = parseDateTimestamp(valA);
        const timeB = parseDateTimestamp(valB);
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      // Numeric sort
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      // Text sort (A -> Z or Z -> A) (Requirement 11)
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortDirection === "asc" 
        ? strA.localeCompare(strB, "id-ID")
        : strB.localeCompare(strA, "id-ID");
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Column Alignment: text left, numbers right, plate and status center (Requirements 5, 19)
  const getColumnAlignment = (col: Column): "left" | "right" | "center" => {
    if (col.align) return col.align;
    const lower = col.key.toLowerCase();

    // Plate: center (Requirement 19)
    if (lower === "nopol" || lower.includes("plat")) {
      return "center";
    }

    // Status: center (Requirement 19)
    if (lower === "status" || lower.includes("status") || lower === "bpkb" || lower === "r4 / r2") {
      return "center";
    }

    // Number / currency: right (Requirement 19)
    if (
      lower.includes("uang") || 
      lower.includes("biaya") || 
      lower.includes("profit") || 
      lower.includes("cashback") || 
      lower.includes("nominal") || 
      lower.includes("total") || 
      lower.includes("debit") || 
      lower.includes("kredit") || 
      lower.includes("tagihan") ||
      lower.includes("terbayar") ||
      lower.includes("sisa") ||
      lower.includes("kekurangan") ||
      lower === "in" ||
      lower === "out"
    ) {
      return "right";
    }

    // Text / general: left (Requirement 19)
    return "left";
  };

  // Export columns (excluding action columns)
  const exportColumns = useMemo<ExportColumn[]>(() => {
    return columns
      .filter((c) => {
        const k = c.key.toLowerCase();
        if (k === "aksi" || k === "actions" || k === "aksipelunasan") return false;
        return savedVisibleColumnKeys.has(c.key);
      })
      .map((c) => ({
        key: c.key,
        label: c.label,
        align: getColumnAlignment(c),
      }));
  }, [columns, savedVisibleColumnKeys]);

  // Preview / filtered dataset for export respecting table filters and export period
  const previewExportData = useMemo(() => {
    return filterDataByExportPeriod(filteredData, exportColumns, exportPeriod, {
      start: customStartDate,
      end: customEndDate,
    });
  }, [filteredData, exportColumns, exportPeriod, customStartDate, customEndDate]);

  const getExportPeriodLabel = (): string => {
    switch (exportPeriod) {
      case "all":
        return "Semua Data Aktif";
      case "today":
        return `Hari Ini (${new Date().toLocaleDateString("id-ID")})`;
      case "this_week":
        return "Minggu Ini";
      case "this_month":
        return new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      case "this_year":
        return `Tahun ${new Date().getFullYear()}`;
      case "custom":
        return `${customStartDate || "Awal"} s/d ${customEndDate || "Akhir"}`;
      default:
        return "Semua";
    }
  };

  const handleExecuteExport = () => {
    if (previewExportData.length === 0) {
      toast.error("Tidak ada data yang dapat diekspor untuk periode ini");
      return;
    }

    const title = subTabTitle ? `Laporan Keuangan - ${subTabTitle}` : "Laporan Keuangan SUN89";
    const periodLabel = getExportPeriodLabel();

    try {
      if (exportFormat === "csv") {
        exportToCSV({
          title,
          columns: exportColumns,
          data: previewExportData,
          periodLabel,
        });
        toast.success(`Berhasil mengunduh CSV (${previewExportData.length} baris)`);
      } else {
        exportToPDF({
          title,
          subTitle: "Biro Jasa SUN89 - Laporan Operasional & Keuangan",
          periodLabel,
          columns: exportColumns,
          data: previewExportData,
        });
        toast.success(`Dokumen cetak / PDF (${previewExportData.length} baris) siap dicetak`);
      }

      if (onExport) {
        onExport(exportFormat);
      }

      setIsExportDialogOpen(false);
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Gagal mengekspor data: " + (err?.message || "Terjadi kesalahan"));
    }
  };

  const formatCellValue = (value: any, key: string, item: any, col: Column) => {
    if (col.render) {
      return col.render(value, item);
    }

    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">-</span>;
    }

    const lowerKey = key.toLowerCase();

    // Plate numbers (Requirement 22)
    if (lowerKey === "nopol" || lowerKey.includes("plat")) {
      return <PlateNumberBadge plate={String(value)} />;
    }

    // Dates in numeric DD/MM/YYYY (Requirement 9 & 15)
    if (lowerKey.includes("tanggal") || lowerKey.includes("tgl") || lowerKey.includes("tempo")) {
      return (
        <span className="finance-table__date font-mono text-[10px] text-muted-foreground/85 whitespace-nowrap">
          {formatDateDDMMYYYY(String(value))}
        </span>
      );
    }

    // Secondary metadata: Order numbers and Invoice numbers (de-emphasized)
    if (
      lowerKey === "nomor order" ||
      lowerKey === "no order" ||
      lowerKey === "orderno" ||
      lowerKey === "order_no" ||
      lowerKey === "no invoice" ||
      lowerKey === "nomor invoice" ||
      lowerKey === "invoiceno" ||
      lowerKey === "invoice"
    ) {
      return (
        <span className="font-mono text-[10px] text-muted-foreground/85 font-medium whitespace-nowrap">
          {String(value)}
        </span>
      );
    }

    // Customer name with sentence case preserving acronyms (Requirement 7: Primary Business Data)
    if (lowerKey === "customer" || lowerKey === "nama customer") {
      return <span className="text-foreground font-semibold">{formatCustomerName(String(value))}</span>;
    }

    // Nama berkas with sentence case preserving acronyms (Requirement 8)
    if (lowerKey === "nama" || lowerKey === "namaberkas" || lowerKey === "namasesuaibpkb") {
      return <span className="text-foreground/90 font-medium">{formatBerkasName(String(value))}</span>;
    }

    // Jenis Pengurusan / Layanan (Primary Business Data)
    if (lowerKey === "pengurusan" || lowerKey === "jenis pengurusan" || lowerKey === "layanan") {
      return <span className="text-foreground/90 font-medium">{String(value)}</span>;
    }

    // Status as PLAIN TEXT without pill/badge (Requirement 23 & Phase 9.1)
    if (lowerKey.includes("status") || lowerKey === "bpkb") {
      return <PlainTextStatus status={String(value)} />;
    }

    // Dokumen indicator (digital documents count)
    if (lowerKey === "dokumen") {
      const count = item.attachedDocsCount || 0;
      if (count > 0) {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <FileText className="w-3 h-3" />
            {value}
          </span>
        );
      }
      return (
        <span className="text-[10px] text-muted-foreground/70 italic">
          Belum Ada
        </span>
      );
    }

    // Currency values
    if (typeof value === "number") {
      const isMonetary = 
        lowerKey.includes("uang") || 
        lowerKey.includes("biaya") || 
        lowerKey.includes("profit") || 
        lowerKey.includes("cashback") || 
        lowerKey.includes("nominal") || 
        lowerKey.includes("total") || 
        lowerKey.includes("debit") || 
        lowerKey.includes("kredit") || 
        lowerKey.includes("tagihan") ||
        lowerKey.includes("terbayar") ||
        lowerKey.includes("sisa") ||
        lowerKey.includes("kekurangan") ||
        lowerKey === "in" ||
        lowerKey === "out";

      if (isMonetary) {
        if (value < 0) {
          return <span className="finance-table__currency font-mono tabular-nums text-rose-600 dark:text-rose-400 font-medium">{formatRupiah(value)}</span>;
        } else if (lowerKey.includes("profit") || lowerKey.includes("masuk") || lowerKey === "in" || lowerKey === "debit") {
          return <span className="finance-table__currency font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatRupiah(value)}</span>;
        } else if (lowerKey.includes("keluar") || lowerKey === "out" || lowerKey === "kredit" || lowerKey.includes("biaya")) {
          return <span className="finance-table__currency font-mono tabular-nums text-rose-500 dark:text-rose-400 font-medium">{formatRupiah(value)}</span>;
        }
        return <span className="finance-table__currency font-mono tabular-nums text-foreground font-medium">{formatRupiah(value)}</span>;
      }
    }

    return <span className="text-foreground/90">{String(value)}</span>;
  };

  const handleEditClick = (item: any) => {
    if (bypassInternalEditDialog && onEdit) {
      onEdit(item, item);
      return;
    }
    setSelectedItem(item);
    setEditFormData({ ...item });
    setInitialEditSnapshot(JSON.stringify(item));
    setIsEditDialogOpen(true);
  };

  const handleEditFieldChange = (fieldKey: string, value: any) => {
    const updated = { ...editFormData, [fieldKey]: value };

    // Financial calculations & live derivations
    if (
      fieldKey === "Uang Masuk dari Konsumen" ||
      fieldKey === "Biaya Pokok Samsat" ||
      fieldKey === "Biaya Jasa" ||
      fieldKey === "Biaya Antar Jemput" ||
      fieldKey === "Biaya Lainnya" ||
      fieldKey === "Total Tagihan Konsumen"
    ) {
      const uangMasuk = Math.max(0, Number(fieldKey === "Uang Masuk dari Konsumen" ? value : updated["Uang Masuk dari Konsumen"] || 0));
      const biayaSamsat = Math.max(0, Number(fieldKey === "Biaya Pokok Samsat" ? value : updated["Biaya Pokok Samsat"] || 0));
      const biayaJasa = Math.max(0, Number(fieldKey === "Biaya Jasa" ? value : updated["Biaya Jasa"] || 0));
      const biayaAntar = Math.max(0, Number(fieldKey === "Biaya Antar Jemput" ? value : updated["Biaya Antar Jemput"] || 0));
      const biayaLainnya = Math.max(0, Number(fieldKey === "Biaya Lainnya" ? value : updated["Biaya Lainnya"] || 0));

      let totalTagihan = Number(fieldKey === "Total Tagihan Konsumen" ? value : updated["Total Tagihan Konsumen"] || 0);

      if (fieldKey === "Biaya Pokok Samsat" || fieldKey === "Biaya Jasa" || fieldKey === "Biaya Antar Jemput" || fieldKey === "Biaya Lainnya") {
        totalTagihan = biayaSamsat + biayaJasa + biayaAntar + biayaLainnya;
        updated["Total Tagihan Konsumen"] = totalTagihan;
      } else if (totalTagihan === 0 && uangMasuk > 0 && fieldKey === "Uang Masuk dari Konsumen") {
        totalTagihan = uangMasuk;
        updated["Total Tagihan Konsumen"] = totalTagihan;
      }

      const sisaTagihan = Math.max(0, totalTagihan - uangMasuk);
      const cashback = Math.max(0, uangMasuk - totalTagihan);
      const profit = Math.max(0, totalTagihan - biayaSamsat);

      updated["Sisa Tagihan"] = sisaTagihan;
      updated["Jumlah Cashback"] = cashback;
      updated["Profit"] = profit;

      // Update status pembayaran if not locked by canonical order
      const isCanonical = typeof selectedItem?.id === "string" && (selectedItem.id.startsWith("ord:") || selectedItem.id.toUpperCase().startsWith("ORD-"));
      if (!isCanonical) {
        if (uangMasuk === 0) {
          updated["Status Pembayaran"] = "Belum Bayar";
        } else if (totalTagihan > 0 && uangMasuk < totalTagihan) {
          updated["Status Pembayaran"] = "Kurang Bayar";
        } else if (totalTagihan > 0 && uangMasuk > totalTagihan) {
          updated["Status Pembayaran"] = "Kelebihan Bayar";
        } else {
          updated["Status Pembayaran"] = "Lunas";
        }
      }
    }

    // Bidirectional sync
    if (fieldKey === "Samsat Asal") {
      updated["Samsat"] = value;
    } else if (fieldKey === "Samsat") {
      updated["Samsat Asal"] = value;
    }

    if (fieldKey === "Dokumen BPKB") {
      updated["BPKB"] = value;
    } else if (fieldKey === "BPKB") {
      updated["Dokumen BPKB"] = value;
    }

    if (fieldKey === "Nomor TTB BPKB") {
      updated["TTB BPKB"] = value;
    } else if (fieldKey === "TTB BPKB") {
      updated["Nomor TTB BPKB"] = value;
    }

    if (fieldKey === "Tanda Terima") {
      updated["Nomor Tanda Terima"] = value;
    } else if (fieldKey === "Nomor Tanda Terima") {
      updated["Tanda Terima"] = value;
    }

    setEditFormData(updated);
  };

  const handleDeleteClick = (item: any) => {
    if (bypassInternalDeleteDialog && onDelete) {
      onDelete(item);
      return;
    }
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleEditSubmit = () => {
    if (editFields) {
      for (const field of editFields) {
        const isCoreRequired = field.key === "Plat No" || field.key === "Nama Customer";
        if (field.required || isCoreRequired) {
          const val = editFormData[field.key];
          if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
            toast.error(`${field.label} wajib diisi`);
            return;
          }
        }
      }
    }

    if (onEdit && selectedItem) {
      onEdit(selectedItem, editFormData);
    }
    setIsEditDialogOpen(false);
    toast.success("Data transaksi berhasil diperbarui");
  };

  const handleDeleteConfirm = async () => {
    if (onDelete && selectedItem) {
      try {
        setIsDeleting(true);
        await Promise.resolve(onDelete(selectedItem));
        setIsDeleteDialogOpen(false);
        setSelectedItem(null);
        toast.success("Data transaksi berhasil dihapus");
      } catch (err: any) {
        toast.error(err?.message || "Gagal menghapus data transaksi.");
      } finally {
        setIsDeleting(false);
      }
    } else {
      setIsDeleteDialogOpen(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm("");
    setDateFilter(null);
    setSortKey(null);
    setSortDirection(null);
  };

  const hasActiveFilters = 
    Object.values(filters).some(v => v && v !== "all") || 
    searchTerm !== "" || 
    dateFilter !== null ||
    sortKey !== null;

  return (
    <div className="finance-table-container flex-1 flex flex-col min-h-0 space-y-3.5">
      {/* Table Toolbar (Phase 8.5: Refined Hierarchy — Tambah, Filter, Pengaturan Tabel, Search) */}
      <div className="flex flex-col md:flex-row gap-2.5 justify-between items-stretch md:items-center">
        {/* Left Section: Action Tambah + Filter (with internal date control) + Pengaturan Tabel (with integrated export) */}
        <div className="flex items-center gap-2 flex-wrap">
          {onAdd && !hideAddButton && (
            <Button
              onClick={onAdd}
              size="sm"
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </Button>
          )}

          {/* Filter Popover Interaction: Contains Date Picker + Category Dropdowns + Apply/Reset */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Filter data tabel"
                className={cn(
                  "h-8 text-xs border-border gap-1.5 shrink-0",
                  (isFilterOpen || hasActiveFilters) && "border-primary/50 text-primary bg-primary/5"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] p-4 space-y-3.5 bg-popover text-popover-foreground border-border shadow-md"
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('[data-radix-popper-content-wrapper], [data-radix-portal], [role="dialog"], [role="listbox"], [role="option"]')) {
                  e.preventDefault();
                }
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div>
                  <h4 className="font-semibold text-sm leading-tight text-foreground">Filter</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Filter data transaksi tabel</p>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Tanggal Selection INSIDE Filter Interaction */}
              {hasDateColumn && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/85">Tanggal</Label>
                  <FinanceDateFilter
                    value={dateFilter}
                    onChange={(v) => {
                      setDateFilter(v);
                      setCurrentPage(1);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {/* Category dropdown filters */}
              {structuredFilterColumns.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-border/70">
                  <Label className="text-xs font-semibold text-foreground/85">Kategori</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {structuredFilterColumns.map((col) => {
                      const options =
                        col.filterOptions ||
                        Array.from(new Set(data.map((d) => d[col.key]).filter(Boolean))).sort();
                      return (
                        <div key={col.key} className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">{col.label}</Label>
                          <Select
                            value={filters[col.key] || "all"}
                            onValueChange={(value) => {
                              setFilters({ ...filters, [col.key]: value });
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="bg-background border-border h-8 text-xs font-normal">
                              <SelectValue placeholder={`Semua ${col.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">
                                Semua
                              </SelectItem>
                              {options.map((opt: any) => (
                                <SelectItem key={String(opt)} value={String(opt)} className="text-xs">
                                  {String(opt)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer with Reset and Terapkan */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border/70">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearFilters();
                    setIsFilterOpen(false);
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 shadow-2xs"
                >
                  Terapkan
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Table Settings & Integrated Export (Reachable on desktop & mobile) */}
          <Popover open={isSettingsOpen} onOpenChange={handleSettingsOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Pengaturan tabel"
                className="inline-flex h-8 text-xs border-border gap-1.5 shrink-0 relative"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Pengaturan tabel</span>
                {hasUnsavedSettings && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 absolute -top-1 -right-1 ring-2 ring-background" title="Terdapat perubahan yang belum disimpan" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 max-w-[calc(100vw-1.5rem)] p-4 space-y-4 bg-popover text-popover-foreground border-border shadow-md"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div>
                  <h4 className="font-semibold text-sm leading-tight text-foreground">Pengaturan tabel</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasUnsavedSettings ? "Perubahan draft belum disimpan" : "Tersimpan di browser"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetTableSettings}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Kembalikan semua kolom dan font ke default"
                >
                  Reset
                </Button>
              </div>

              {/* Indicator if changes are unsaved */}
              {hasUnsavedSettings && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                  <span className="font-medium text-[11px]">Terdapat perubahan yang belum disimpan</span>
                </div>
              )}

              {/* Font Size Setting */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground/85">Ukuran teks</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["1x", "2x", "3x"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setDraftTableFontSize(size)}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                        draftTableFontSize === size
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background hover:bg-muted text-foreground border-border"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full border ${draftTableFontSize === size ? "bg-primary-foreground border-primary-foreground" : "border-muted-foreground"}`} />
                      <span>{size}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Visibility Setting */}
              <div className="space-y-2 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground/85">Kolom yang ditampilkan</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {draftVisibleColumnKeys.size} dari {columns.length} aktif
                  </span>
                </div>

                <div className="border border-border rounded-md p-2 bg-muted/20 space-y-2">
                  {/* Select All Checkbox */}
                  <label className="flex items-center gap-2.5 p-1 rounded hover:bg-muted/50 cursor-pointer text-xs font-semibold select-none border-b border-border/60 pb-1.5">
                    <Checkbox
                      checked={draftSelectAllState}
                      onCheckedChange={handleDraftToggleSelectAll}
                    />
                    <span className="text-foreground">Pilih semua</span>
                  </label>

                  {/* Scrollable list of individual columns */}
                  <ScrollArea className="h-40 pr-1.5">
                    <div className="space-y-1">
                      {columns.map((col) => {
                        const isChecked = draftVisibleColumnKeys.has(col.key);
                        return (
                          <label
                            key={col.key}
                            className="flex items-center gap-2.5 p-1 rounded hover:bg-muted/50 cursor-pointer text-xs select-none"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleDraftToggleColumn(col.key)}
                            />
                            <span className={isChecked ? "text-foreground font-medium" : "text-muted-foreground"}>
                              {col.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Tombol Simpan Pengaturan */}
              <div className="pt-2 border-t border-border/70 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveTableSettings}
                  className="w-full h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Pengaturan</span>
                </Button>
              </div>

              {/* Integrated Export Action Section */}
              <div className="space-y-2 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground/85">Ekspor data</Label>
                  <span className="text-[11px] text-muted-foreground">CSV / PDF</span>
                </div>
                <p className="text-xs text-muted-foreground">Unduh laporan transaksi sesuai filter dan kolom aktif</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="w-full h-8 text-xs border-border gap-1.5 justify-center hover:bg-primary/5 hover:text-primary hover:border-primary/40 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Buka dialog ekspor</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right Section: Single Main Search Field */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || "Cari berdasarkan nomor polisi, nama customer, invoice..."}
            aria-label={searchPlaceholder || "Cari berdasarkan nomor polisi, nama customer, invoice"}
            className="pl-8 bg-background border-border h-8 text-xs font-normal placeholder:font-normal placeholder:text-muted-foreground/60"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>


      {/* Main Table: Desktop (Full Columns with desktop settings) & Mobile (2 Primary Columns + Actions) */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
        <div className="w-full flex-1 flex flex-col min-h-0">
          <Table 
            containerClassName={cn(
              "flex-1 min-h-[160px] md:min-h-0 overflow-y-auto overflow-x-auto",
              tableContainerClassName



            )}
            className={`finance-table finance-table--font-${savedTableFontSize === "1x" ? "1" : savedTableFontSize === "2x" ? "2" : "3"} w-full min-w-[700px] md:min-w-[850px] ${paginatedData.length === 0 ? "h-full" : ""}`}
          >
            <TableHeader className="finance-table__header sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
              <TableRow className="hover:bg-transparent">
                {/* No. Column (Row Numbering - always visible, cannot be hidden via settings) */}
                <TableHead className="h-9 px-2 font-semibold text-foreground/80 text-center whitespace-nowrap text-[10px] w-12 min-w-[48px] max-w-[48px] bg-card">
                  No.
                </TableHead>

                {columns.map(col => {
                  const isVisibleDesktop = savedVisibleColumnKeys.has(col.key);
                  const isMobileVisible = mobilePrimaryKeys.has(col.key);

                  if (!isVisibleDesktop && !isMobileVisible) return null;

                  const visibilityClass = isMobileVisible && isVisibleDesktop
                    ? ""
                    : isVisibleDesktop
                      ? "hidden md:table-cell"
                      : "table-cell md:hidden";

                  const align = getColumnAlignment(col);
                  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
                  const isSorted = sortKey === col.key;

                  return (
                    <TableHead 
                      key={col.key} 
                      onClick={() => handleSortToggle(col.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSortToggle(col.key);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-sort={isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      aria-label={`Urutkan kolom ${col.label}`}
                      className={`h-9 px-3.5 font-semibold text-foreground/80 whitespace-nowrap text-[10px] select-none cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${alignClass} ${visibilityClass} bg-card`}
                    >
                      <div className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : align === "center" ? "justify-center" : "flex-row"}`}>
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3 text-primary shrink-0" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-primary shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30 hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </TableHead>
                  );
                })}

                {/* Actions Column Header (Desktop & Mobile, Requirement 10 & 11) */}
                {!suppressTrailingActionColumn && (
                  <TableHead className="h-9 px-2 font-semibold text-foreground/80 text-center whitespace-nowrap text-[10px] w-[95px] bg-card">
                    Aksi
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="finance-table__body">
              {paginatedData.length === 0 ? (
                <TableRow className="h-full hover:bg-transparent">
                  <TableCell 
                    colSpan={columns.filter(c => savedVisibleColumnKeys.has(c.key) || mobilePrimaryKeys.has(c.key)).length + (suppressTrailingActionColumn ? 0 : 1) + 1} 
                    className="h-full min-h-[200px] text-center p-0 align-middle"
                  >
                    <EmptyState
                      icon={FileQuestion}
                      title="Tidak ada data transaksi yang ditemukan"
                      description="Periksa filter pencarian atau tambahkan transaksi baru."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, idx) => {
                  const rowNumber = (serverPageOffset !== undefined ? serverPageOffset : startIndex) + idx + 1;
                  return (
                    <TableRow
                      key={item.id || idx}
                      className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10"
                    >
                      {/* No. Cell (Row Numbering - always visible, cannot be hidden via settings) */}
                      <TableCell className="px-2 py-2 text-center text-muted-foreground font-mono text-[10px] tabular-nums w-12 min-w-[48px] max-w-[48px]">
                        {rowNumber}
                      </TableCell>

                      {columns.map(col => {
                        const isVisibleDesktop = savedVisibleColumnKeys.has(col.key);
                        const isMobileVisible = mobilePrimaryKeys.has(col.key);

                        if (!isVisibleDesktop && !isMobileVisible) return null;

                        const visibilityClass = isMobileVisible && isVisibleDesktop
                          ? ""
                          : isVisibleDesktop
                            ? "hidden md:table-cell"
                            : "table-cell md:hidden";

                        const align = getColumnAlignment(col);
                        const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

                        return (
                          <TableCell 
                            key={col.key} 
                            className={`px-3.5 py-2 text-[10px] ${alignClass} ${visibilityClass}`}
                          >
                            {formatCellValue(item[col.key], col.key, item, col)}
                          </TableCell>
                        );
                      })}

                    {/* Actions Cell (Requirements 10 & 11: Direct visible View, Edit, Delete with soft default and distinct hover) */}
                    {!suppressTrailingActionColumn && (
                      <TableCell className="px-2 py-1.5 text-center">
                      <div className="finance-table__actions flex items-center justify-center gap-1">
                        {onView && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(item)}
                            aria-label="Lihat detail transaksi"
                            className="finance-action-btn h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onPrint && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onPrint(item)}
                            aria-label="Cetak invoice A5"
                            title="Cetak Invoice A5"
                            className="finance-action-btn h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onEdit && !hideEditButton && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(item)}
                            aria-label="Ubah transaksi"
                            className="finance-action-btn h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onDelete && !hideDeleteButton && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(item)}
                            aria-label="Hapus transaksi"
                            className="finance-action-btn h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Standardized Table Pagination */}
      <div className="mt-auto pt-1 shrink-0">
        <TablePagination
          currentPage={currentPage}
          totalItems={sortedData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newSize) => {
            setItemsPerPage(newSize);
            setCurrentPage(1);
            persistTableSettings(savedVisibleColumnKeys, savedTableFontSize, newSize);
          }}
          pageSizeOptions={itemsPerPageOptions}
        />
      </div>

      {/* Optional Bottom Summary Slot (e.g. Data Penjualan Totals) */}
      {renderBottom && (
        <div className="pt-3 border-t border-border/60 shrink-0">
          {renderBottom({ filteredData, sortedData, totalItems: sortedData.length })}
        </div>
      )}

      {/* Edit Data Modal (For surgical inline update following Buat Order design standards) */}
      {editFields && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCancelEdit();
          }
        }}>
          <DialogContent className="border-border sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-3 border-b border-border/60 sticky top-0 bg-card z-10 shrink-0">
              <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Edit className="w-4 h-4 text-primary" />
                <span>Ubah Data Transaksi {subTabTitle ? `— ${subTabTitle}` : ""}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Perbarui rincian informasi data transaksi sesuai standar formulir operasional
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(() => {
                const CANONICAL_SERVICES_OPTIONS = [
                  "Perpanjangan 1 Tahun",
                  "Perpanjangan 5 Tahun",
                  "Mutasi Asal Samsat",
                  "Mutasi Antar Daerah",
                  "Balik Nama",
                  "Tarik Berkas",
                  "Duplikat STNK",
                ];

                const STATUS_PENGERJAAN_OPTIONS = [
                  "Dalam Proses",
                  "Pending",
                  "Menunggu Arsip",
                  "Selesai",
                  "Dibatalkan",
                ];

                const STATUS_PEMBAYARAN_OPTIONS = [
                  "Belum Bayar",
                  "Kurang Bayar",
                  "Lunas",
                  "Kelebihan Bayar",
                  "Dibatalkan",
                ];

                const SKEMA_PEMBAYARAN_OPTIONS = [
                  "Bayar di Awal",
                  "Bayar di Akhir",
                  "Tempo",
                ];

                const DOKUMEN_BPKB_OPTIONS = [
                  "Ada",
                  "Tidak Ada",
                  "Di Konsumen",
                  "Di Samsat",
                  "Di Leasing",
                ];

                const R4_R2_OPTIONS = ["R4", "R2"];

                const isCanonicalOrder = typeof selectedItem?.id === "string" && (selectedItem.id.startsWith("ord:") || selectedItem.id.toUpperCase().startsWith("ORD-"));
                const isDerivedOrderField = (key: string) => {
                  return (
                    key === "Nomor Order" ||
                    key === "No Order" ||
                    key === "No Invoice" ||
                    key === "Sisa Tagihan" ||
                    key === "Profit" ||
                    key === "Jumlah Cashback" ||
                    (isCanonicalOrder && (
                      key === "Status Pengerjaan" ||
                      key === "Status Pembayaran"
                    ))
                  );
                };

                const getLockBadgeLabel = (key: string) => {
                  if (key === "Nomor Order" || key === "No Order") return "Kanonis";
                  if (key === "No Invoice") return "Faktur";
                  if (key === "Sisa Tagihan" || key === "Profit" || key === "Jumlah Cashback") return "Kalkulasi";
                  if (key === "Status Pengerjaan" || key === "Status Pembayaran") return "Alur Order";
                  return "Read-only";
                };

                const renderSingleField = (field: any) => {
                  const isReadOnly = Boolean(field.readOnly || isDerivedOrderField(field.key));
                  const isOrderLocked = isDerivedOrderField(field.key);

                  // Determine options for select fields
                  let options = field.options;
                  if (!options) {
                    if (field.key === "Jenis Pengurusan") options = CANONICAL_SERVICES_OPTIONS;
                    else if (field.key === "Status Pengerjaan") options = STATUS_PENGERJAAN_OPTIONS;
                    else if (field.key === "Status Pembayaran") options = STATUS_PEMBAYARAN_OPTIONS;
                    else if (field.key === "Skema Pembayaran") options = SKEMA_PEMBAYARAN_OPTIONS;
                    else if (field.key === "Dokumen BPKB" || field.key === "BPKB") options = DOKUMEN_BPKB_OPTIONS;
                    else if (field.key === "R4 / R2") options = R4_R2_OPTIONS;
                  }

                  const isSelect = Boolean(options && options.length > 0) || field.type === "select";

                  const isCurrencyField =
                    field.key === "Uang Masuk dari Konsumen" ||
                    field.key === "Biaya Pokok Samsat" ||
                    field.key === "Biaya Jasa" ||
                    field.key === "Biaya Antar Jemput" ||
                    field.key === "Biaya Lainnya" ||
                    field.key === "Total Tagihan Konsumen" ||
                    field.key === "Sisa Tagihan" ||
                    field.key === "Profit" ||
                    field.key === "Jumlah Cashback";

                  return (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground/90">
                          {field.label} {!isReadOnly && <span className="text-destructive">*</span>}
                        </Label>
                        {isReadOnly && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted text-muted-foreground rounded border border-border">
                            {getLockBadgeLabel(field.key)}
                          </span>
                        )}
                      </div>

                      {field.type === "plate-number" || (!isReadOnly && (field.key === "Plat No" || field.key === "Nomor Polisi" || field.key === "nopol")) ? (
                        <PlateNumberInput
                          value={editFormData[field.key] || ""}
                          onChange={(val) => handleEditFieldChange(field.key, val)}
                          disabled={isReadOnly}
                        />
                      ) : field.type === "samsat-select" || (!isReadOnly && (field.key === "Samsat" || field.key === "Samsat Asal" || field.key === "Samsat Tujuan" || field.key === "Wilayah Samsat Asal" || field.key === "Wilayah Samsat")) ? (
                        <SearchableSamsatSelect
                          value={editFormData[field.key] || ""}
                          onValueChange={(val) => handleEditFieldChange(field.key, val)}
                          disabled={isReadOnly}
                          placeholder={`Pilih ${field.label.toLowerCase()}`}
                        />
                      ) : isSelect && !isReadOnly ? (
                        <Select
                          value={editFormData[field.key] || (options ? options[0] : "")}
                          onValueChange={(value) => handleEditFieldChange(field.key, value)}
                        >
                          <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                            <SelectValue placeholder={`Pilih ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt: string) => (
                              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isCurrencyField ? (
                        <div className="space-y-1">
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                            placeholder="0"
                            className={cn(
                              "bg-input-background border-border h-9 text-xs font-mono font-medium",
                              isReadOnly && "bg-muted/40 text-muted-foreground cursor-not-allowed select-none opacity-85"
                            )}
                            value={editFormData[field.key] !== undefined ? editFormData[field.key] : ""}
                            onChange={(e) => {
                              if (!isReadOnly) {
                                handleEditFieldChange(field.key, e.target.value);
                              }
                            }}
                          />
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>{formatRupiah(Number(editFormData[field.key]) || 0)}</span>
                            {field.helpText && <span>{field.helpText}</span>}
                          </div>
                        </div>
                      ) : (
                        <Input
                          type={field.type === "select" ? "text" : field.type}
                          readOnly={isReadOnly}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || (isReadOnly ? "Diturunkan otomatis" : `Masukkan ${field.label.toLowerCase()}`)}
                          className={cn(
                            "bg-input-background border-border h-9 text-xs",
                            isReadOnly && "bg-muted/40 text-muted-foreground cursor-not-allowed select-none opacity-80"
                          )}
                          value={editFormData[field.key] !== undefined ? editFormData[field.key] : ""}
                          onChange={(e) => {
                            if (!isReadOnly) {
                              handleEditFieldChange(field.key, e.target.value);
                            }
                          }}
                        />
                      )}

                      {!isCurrencyField && (field.helpText || isOrderLocked) && (
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {isOrderLocked && (field.key === "Status Pengerjaan" || field.key === "Status Pembayaran")
                            ? "Ditentukan otomatis oleh tahapan proses order tracking kanonis."
                            : field.helpText}
                        </p>
                      )}
                    </div>
                  );
                };

                const berkasKeys = ["polisi", "plat", "nopol", "customer", "pemilik", "kendaraan", "samsat", "telp", "hp", "r4", "r2", "order"];
                const keuanganKeys = ["uang", "bayar", "biaya", "tagihan", "profit", "saldo", "masuk", "keluar", "nominal", "rekening", "bank", "invoice", "cashback"];
                const operasionalKeys = ["layanan", "pengurusan", "status", "bpkb", "ttb", "tanda terima", "keterangan"];

                const berkasFields = editFields.filter((f) => {
                  const k = f.key.toLowerCase();
                  return berkasKeys.some((bk) => k.includes(bk));
                });

                const keuanganFields = editFields.filter((f) => {
                  const k = f.key.toLowerCase();
                  return !berkasKeys.some((bk) => k.includes(bk)) && keuanganKeys.some((fk) => k.includes(fk));
                });

                const operasionalFields = editFields.filter((f) => {
                  const k = f.key.toLowerCase();
                  return !berkasKeys.some((bk) => k.includes(bk)) && !keuanganKeys.some((fk) => k.includes(fk));
                });

                const hasSections = (berkasFields.length > 0 && (keuanganFields.length > 0 || operasionalFields.length > 0)) ||
                                    (keuanganFields.length > 0 && operasionalFields.length > 0);

                if (!hasSections) {
                  return (
                    <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {editFields.map(renderSingleField)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {berkasFields.length > 0 && (
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                          <Car className="w-3.5 h-3.5 text-primary" />
                          1. Data Klien & Kendaraan
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {berkasFields.map(renderSingleField)}
                        </div>
                      </div>
                    )}

                    {operasionalFields.length > 0 && (
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          2. Layanan & Operasional
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {operasionalFields.map(renderSingleField)}
                        </div>
                      </div>
                    )}

                    {keuanganFields.length > 0 && (
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                          <CreditCard className="w-3.5 h-3.5 text-primary" />
                          3. Keuangan & Administrasi
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {keuanganFields.map(renderSingleField)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="p-4 pt-3 border-t border-border/60 sticky bottom-0 bg-card z-10 shrink-0 flex items-center justify-between sm:justify-between">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} className="text-xs h-9 px-4">
                Batal
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-4 font-semibold shadow-xs flex items-center gap-1.5" onClick={handleEditSubmit}>
                <Check className="w-3.5 h-3.5" />
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Discard Confirmation Alert Dialog */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Perubahan Belum Disimpan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Anda memiliki perubahan pada data yang belum disimpan. Jika Anda membatalkan sekarang, semua perubahan yang Anda lakukan akan dibuang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-between sm:justify-between w-full">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 text-xs font-medium"
              onClick={() => setIsDiscardDialogOpen(false)}
            >
              Lanjutkan Mengedit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleConfirmDiscardEdit}
            >
              Buang Perubahan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open && !isDeleting) setIsDeleteDialogOpen(false); }}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Hapus Data Transaksi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus data <strong className="text-foreground">{itemIdentifier}</strong>?
              </p>
              <p className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-[11px] font-medium leading-relaxed">
                Tindakan ini tidak dapat dibatalkan dan akan menghapus catatan transaksi dari modul {subTabTitle || "keuangan"}.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-between sm:justify-between w-full">
            <AlertDialogCancel disabled={isDeleting} className="text-xs h-8">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8 font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Ya, Hapus Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog (Requirement: Export CSV & PDF with period selector & preview) */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span>Ekspor Data {subTabTitle || "Tabel"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih format berkas dan rentang periode data yang ingin diekspor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Format Selection Cards */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Format Ekspor</Label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    exportFormat === "csv"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className={`w-4 h-4 ${exportFormat === "csv" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold text-foreground">CSV / Excel</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Format spreadsheet UTF-8 BOM, kompatibel dengan MS Excel
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat("pdf")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    exportFormat === "pdf"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Printer className={`w-4 h-4 ${exportFormat === "pdf" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold text-foreground">PDF / Cetak</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Tata letak resmi siap cetak & simpan dokumen PDF
                  </span>
                </button>
              </div>
            </div>

            {/* Period Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Pilihan Periode</Label>
              <Select value={exportPeriod} onValueChange={(val) => setExportPeriod(val as ExportPeriodOption)}>
                <SelectTrigger className="bg-background border-border h-8 text-xs font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Data Aktif (Sesuai Filter)</SelectItem>
                  <SelectItem value="today" className="text-xs">Hari Ini</SelectItem>
                  <SelectItem value="this_week" className="text-xs">Minggu Ini</SelectItem>
                  <SelectItem value="this_month" className="text-xs">Bulan Ini</SelectItem>
                  <SelectItem value="this_year" className="text-xs">Tahun Ini</SelectItem>
                  <SelectItem value="custom" className="text-xs">Rentang Tanggal Kustom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Inputs if custom period */}
            {exportPeriod === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Dari Tanggal</Label>
                  <Input
                    type="date"
                    className="bg-background border-border h-8 text-xs font-mono"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Sampai Tanggal</Label>
                  <Input
                    type="date"
                    className="bg-background border-border h-8 text-xs font-mono"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Information preview */}
            <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs space-y-1">
              <div className="flex justify-between items-center text-foreground font-medium">
                <span>Data yang akan diekspor:</span>
                <span className="font-mono text-primary font-bold">{previewExportData.length} baris</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Filter pencarian tabel yang aktif tetap diterapkan pada hasil ekspor.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 flex items-center justify-between sm:justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(false)} className="text-xs h-8">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteExport}
              disabled={previewExportData.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh {exportFormat.toUpperCase()}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
