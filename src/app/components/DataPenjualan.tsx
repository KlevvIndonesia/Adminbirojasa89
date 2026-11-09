import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { Card } from "./ui/card";
import { EnhancedTableWithDialogs, Column } from "./EnhancedTableWithDialogs";
import { FinanceAddPage } from "./FinanceAddPage";
import { FinanceDetailPage } from "./FinanceDetailPage";
import { InvoiceA5Dialog } from "./InvoiceA5Dialog";
import { FinanceSummary } from "./finance/FinanceSummary";
import {
  MutationFeedbackDialog,
  classifyMutationError,
  MutationFeedbackType,
} from "./finance/MutationFeedbackDialog";
import { ActionInlineError } from "./ui/ActionInlineError";
import { ClassifiedActionError, classifyActionError } from "../utils/actionErrorClassifier";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ChevronDown, Check } from "lucide-react";
import { formatRupiah } from "../utils/financeFormatters";
import { computeDataPenjualanTotals } from "../../domain/finance/dataPenjualanTotals";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  CANONICAL_PENJUALAN_COLUMNS_CONTRACT,
  buildTableColumnsFromContract,
  buildFieldsFromContract,
} from "../data/penjualanContractData";
import { useFinanceStore, financeStore, PenjualanContractCategory } from "../data/financeStore";
import type { CanonicalSalesCategory } from "../../domain/finance/types";
import { orderStore } from "../data/orderStore";

export const CANONICAL_SALES_CATEGORIES: CanonicalSalesCategory[] = [
  "perpanjangan-1-tahun",
  "perpanjangan-5-tahun",
  "mutasi-asal",
  "mutasi-antar-daerah",
  "balik-nama",
  "tarik-berkas",
  "duplikat-stnk",
  "lainnya",
];

export const CANONICAL_SERVICES_METADATA: Record<CanonicalSalesCategory, { title: string; searchPlaceholder: string }> = {
  "perpanjangan-1-tahun": {
    title: "Perpanjangan 1 Tahun",
    searchPlaceholder: "Cari data perpanjangan 1 tahun...",
  },
  "perpanjangan-5-tahun": {
    title: "Perpanjangan 5 Tahun",
    searchPlaceholder: "Cari data perpanjangan 5 tahun...",
  },
  "mutasi-asal": {
    title: "Mutasi Asal Samsat",
    searchPlaceholder: "Cari data mutasi asal samsat...",
  },
  "mutasi-antar-daerah": {
    title: "Mutasi Antar Daerah",
    searchPlaceholder: "Cari data mutasi antar daerah...",
  },
  "balik-nama": {
    title: "Balik Nama",
    searchPlaceholder: "Cari data balik nama (BBN)...",
  },
  "tarik-berkas": {
    title: "Tarik Berkas",
    searchPlaceholder: "Cari data tarik berkas...",
  },
  "duplikat-stnk": {
    title: "Duplikat STNK",
    searchPlaceholder: "Cari data duplikat STNK...",
  },
  "lainnya": {
    title: "Lainnya",
    searchPlaceholder: "Cari data pengurusan lainnya...",
  },
};

const LEGACY_CATEGORY_MAP: Record<string, CanonicalSalesCategory> = {
  "mutasi-ld": "mutasi-antar-daerah",
  "mutasi-as": "mutasi-asal",
  bbn: "balik-nama",
  "perpanjangan-pajak": "perpanjangan-1-tahun",
  "lain-lain": "tarik-berkas",
};

const VALID_CATEGORIES = CANONICAL_SALES_CATEGORIES;

// Static Canonical Column Contract across all 8 service tabs (stable reference)
const CANONICAL_COLUMNS = buildTableColumnsFromContract(CANONICAL_PENJUALAN_COLUMNS_CONTRACT);

export function DataPenjualan() {
  const { category } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Robust category resolution: Route param with location.pathname fallback
  const pathCategory = location.pathname.replace(/^\/finance\/data-penjualan\/?/, "").split("/")[0];
  const rawCategory = category || pathCategory;

  const resolvedCategory = (rawCategory && LEGACY_CATEGORY_MAP[rawCategory])
    ? LEGACY_CATEGORY_MAP[rawCategory]
    : (rawCategory as CanonicalSalesCategory);

  // Authoritative URL-driven active tab
  const activeTab: CanonicalSalesCategory = (resolvedCategory && VALID_CATEGORIES.includes(resolvedCategory))
    ? resolvedCategory
    : "perpanjangan-1-tahun";

  useEffect(() => {
    if (rawCategory) {
      if (LEGACY_CATEGORY_MAP[rawCategory]) {
        navigate(`/finance/data-penjualan/${LEGACY_CATEGORY_MAP[rawCategory]}`, { replace: true });
      } else if (!VALID_CATEGORIES.includes(rawCategory as CanonicalSalesCategory)) {
        navigate("/finance/data-penjualan/perpanjangan-1-tahun", { replace: true });
      }
    }
  }, [rawCategory, navigate]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    item: any;
    category: CanonicalSalesCategory;
    title: string;
  } | null>(null);
  const [printingItem, setPrintingItem] = useState<any>(null);
  const [viewingItem, setViewingItem] = useState<{
    item: any;
    subTabTitle: string;
    columns?: Column[];
  } | null>(null);

  // Central Single Source of Truth
  const {
    getContractData,
    updateContractDataAsync,
    addContractDataAsync,
    deleteContractData,
  } = useFinanceStore();

  const isMutatingRef = useRef(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    type: MutationFeedbackType;
    title: string;
    message: string;
    field?: string;
    code?: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const [deleteTargetItem, setDeleteTargetItem] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<ClassifiedActionError | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchFreshData = async () => {
      try {
        setIsLoadingData(true);
        await Promise.allSettled([
          orderStore.initFromApi(),
          financeStore.initFromApi(),
        ]);
      } catch (err) {
        console.error("Failed to load Data Penjualan:", err);
      } finally {
        if (active) setIsLoadingData(false);
      }
    };
    fetchFreshData();
    return () => {
      active = false;
    };
  }, []);

  const handleInitiateDelete = (item: any) => {
    setDeleteTargetItem(item);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetItem || isSubmittingDelete) return;
    if (deleteConfirmText.trim() !== "HAPUS DATA") {
      setDeleteError(
        classifyActionError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: 'Ketik "HAPUS DATA" sama persis untuk mengonfirmasi penghapusan.',
        })
      );
      return;
    }
    try {
      setIsSubmittingDelete(true);
      setDeleteError(null);
      let orderNo: string | null =
        deleteTargetItem.orderNo ||
        deleteTargetItem["Nomor Order"] ||
        deleteTargetItem["No Order"] ||
        deleteTargetItem.order_no ||
        (typeof deleteTargetItem.id === "string" && deleteTargetItem.id.startsWith("ord:")
          ? deleteTargetItem.id.slice(4)
          : (typeof deleteTargetItem.id === "string" && deleteTargetItem.id.toUpperCase().startsWith("ORD-")
            ? deleteTargetItem.id
            : null));

      if (!orderNo) {
        const invNo = deleteTargetItem["No Invoice"] || deleteTargetItem.noInvoice || deleteTargetItem.invoiceNo || deleteTargetItem.invoice;
        if (invNo) {
          const matchingInv = financeStore.getInvoices().find((i: any) => i.invoiceNo === invNo || i.invoice === invNo);
          if (matchingInv?.orderNo) {
            orderNo = matchingInv.orderNo;
          }
        }
      }

      const cleanNo = orderNo ? orderNo.trim().toUpperCase() : String(deleteTargetItem.id);

      // Single authoritative backend delete + local finance/order reconciliation
      if (typeof (financeStore as any).deleteContractDataAsync === "function") {
        await (financeStore as any).deleteContractDataAsync(
          currentMeta.category,
          deleteTargetItem.id,
          orderNo ? cleanNo : undefined
        );
      } else {
        deleteContractData(currentMeta.category, deleteTargetItem.id);
        if (orderNo && typeof (orderStore as any).deleteOrder === "function") {
          await (orderStore as any).deleteOrder(cleanNo);
        } else if (typeof (orderStore as any).deleteArchivedOrder === "function") {
          (orderStore as any).deleteArchivedOrder(cleanNo);
        }
      }

      toast.success(`Data transaksi ${cleanNo} berhasil dihapus permanen.`);
      setDeleteTargetItem(null);
      setDeleteConfirmText("");
      setDeleteError(null);
    } catch (err: any) {
      const classified = classifyActionError(err, { entityLabel: "Data transaksi" });
      setDeleteError(classified);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Unified Canonical Column Contract across all 8 service tabs
  const canonicalColumns = CANONICAL_COLUMNS;

  // Active dataset properties for Add/Edit
  const getActiveTabMeta = () => {
    const current = CANONICAL_SERVICES_METADATA[activeTab] || CANONICAL_SERVICES_METADATA["perpanjangan-1-tahun"];
    return {
      title: current.title,
      category: activeTab,
      columns: canonicalColumns,
      fields: buildFieldsFromContract(CANONICAL_PENJUALAN_COLUMNS_CONTRACT, activeTab),
      data: getContractData(activeTab),
      searchPlaceholder: current.searchPlaceholder,
    };
  };

  const currentMeta = getActiveTabMeta();
  const tabData = currentMeta.data;

  const [filteredPenjualanData, setFilteredPenjualanData] = useState<any[] | null>(null);

  useEffect(() => {
    setFilteredPenjualanData(null);
  }, [activeTab]);

  const handleFilteredDataChange = useCallback((filtered: any[]) => {
    setFilteredPenjualanData((prev) => {
      if (!prev && filtered.length === tabData.length && filtered.every((item, i) => item?.id === tabData[i]?.id)) {
        return null;
      }
      return filtered;
    });
  }, [tabData]);

  const activeFilteredData = filteredPenjualanData ?? tabData;
  const totals = computeDataPenjualanTotals(activeFilteredData, activeTab);

  // Handle Add Submit (Awaits backend confirmation before success feedback or closing form)
  const handleAddSubmit = useCallback(
    async (rows: any[]) => {
      if (isMutatingRef.current) {
        return { success: false };
      }
      isMutatingRef.current = true;
      try {
        const result = await addContractDataAsync(currentMeta.category, rows);
        if (result.success) {
          await Promise.allSettled([
            orderStore.initFromApi(),
            financeStore.initFromApi(),
          ]);
          setIsAdding(false);
          setFeedbackDialog({
            open: true,
            type: "success",
            title: "Data Berhasil Ditambahkan",
            message: "Data penjualan berhasil ditambahkan.",
          });
          return { success: true };
        } else {
          const classified = classifyMutationError(result.error);
          setFeedbackDialog({
            open: true,
            type: "error",
            title: classified.title,
            message: classified.message,
            field: classified.field,
            code: classified.code,
          });
          return { success: false, error: result.error };
        }
      } catch (err: any) {
        const classified = classifyMutationError(err);
        setFeedbackDialog({
          open: true,
          type: "error",
          title: classified.title,
          message: classified.message,
          field: classified.field,
          code: classified.code,
        });
        return { success: false, error: err };
      } finally {
        isMutatingRef.current = false;
      }
    },
    [currentMeta.category, addContractDataAsync]
  );

  const handleBackFromAdd = useCallback(() => {
    setIsAdding(false);
  }, []);

  const handleBackFromEdit = useCallback(() => {
    setEditingItem(null);
  }, []);

  // Handle Edit Submit (Awaits backend confirmation, keeps form open with inputs preserved on failure)
  const handleEditSubmit = useCallback(
    async (rows: any[]) => {
      if (!editingItem || !rows || rows.length === 0) {
        return { success: false };
      }
      if (isMutatingRef.current) {
        return { success: false };
      }
      isMutatingRef.current = true;
      try {
        const result = await updateContractDataAsync(
          editingItem.category,
          editingItem.item.id,
          rows[0]
        );
        if (result.success) {
          await Promise.allSettled([
            orderStore.initFromApi(),
            financeStore.initFromApi(),
          ]);
          setEditingItem(null);
          setFeedbackDialog({
            open: true,
            type: "success",
            title: "Perubahan Berhasil Disimpan",
            message: "Data penjualan berhasil diperbarui.",
          });
          return { success: true };
        } else {
          const classified = classifyMutationError(result.error);
          setFeedbackDialog({
            open: true,
            type: "error",
            title: classified.title,
            message: classified.message,
            field: classified.field,
            code: classified.code,
          });
          return { success: false, error: result.error };
        }
      } catch (err: any) {
        const classified = classifyMutationError(err);
        setFeedbackDialog({
          open: true,
          type: "error",
          title: classified.title,
          message: classified.message,
          field: classified.field,
          code: classified.code,
        });
        return { success: false, error: err };
      } finally {
        isMutatingRef.current = false;
      }
    },
    [editingItem, updateContractDataAsync]
  );

  const renderMainContent = () => {
    // Detail View Full Screen
    if (viewingItem) {
      return (
        <FinanceDetailPage
          subTabTitle={viewingItem.subTabTitle}
          item={viewingItem.item}
          columns={viewingItem.columns}
          onBack={() => setViewingItem(null)}
          onEdit={() => {
            const itemToEdit = viewingItem.item;
            const cat = activeTab;
            const metaTitle = currentMeta.title;
            setViewingItem(null);
            setEditingItem({ item: itemToEdit, category: cat, title: metaTitle });
          }}
        />
      );
    }

    // Full-Page Edit View Full Screen
    if (editingItem) {
      return (
        <FinanceAddPage
          title={`Edit Data Penjualan — ${editingItem.item["Nomor Order"] || editingItem.item.orderNo || editingItem.item["Plat No"] || editingItem.title}`}
          description={`Perbarui rincian transaksi data penjualan untuk kategori ${editingItem.title}`}
          subTabName={editingItem.category}
          category={editingItem.category}
          fields={buildFieldsFromContract(CANONICAL_PENJUALAN_COLUMNS_CONTRACT, editingItem.category)}
          isEdit={true}
          initialData={editingItem.item}
          onBack={handleBackFromEdit}
          onSubmit={handleEditSubmit}
        />
      );
    }

    // Add Page Full Screen
    if (isAdding) {
      return (
        <FinanceAddPage
          title={`Tambah data ${currentMeta.title}`}
          description={`Masukkan satu atau lebih data transaksi untuk kategori ${currentMeta.title}`}
          subTabName={currentMeta.category}
          category={currentMeta.category}
          fields={currentMeta.fields}
          onBack={handleBackFromAdd}
          onSubmit={handleAddSubmit}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Table Card (Maximized Viewport Height with sticky header & internal row scroll) */}
      <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-140px)] min-h-[500px] flex flex-col shrink-0">
        {isLoadingData && tabData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2 flex-1">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Memuat data penjualan {currentMeta.title}...</span>
          </div>
        ) : (
          <EnhancedTableWithDialogs
            columns={canonicalColumns}
            data={tabData}
            subTabTitle={`Data Penjualan - ${currentMeta.title}`}
            bypassInternalDeleteDialog={true}
            bypassInternalEditDialog={true}
            onView={(item) => setViewingItem({ item, subTabTitle: `Data Penjualan - ${currentMeta.title}`, columns: canonicalColumns })}
            onPrint={(item) => setPrintingItem(item)}
            onAdd={() => setIsAdding(true)}
            onEdit={(item) => setEditingItem({ item, category: activeTab, title: currentMeta.title })}
            onDelete={handleInitiateDelete}
            searchPlaceholder={currentMeta.searchPlaceholder}
            editFields={currentMeta.fields}
            onFilteredDataChange={handleFilteredDataChange}
          />
        )}
      </Card>

      {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
      <div className="pt-2 pb-8 shrink-0">
        <FinanceSummary
          items={[
            {
              id: "uang-masuk",
              label: "Total Uang Masuk",
              value: totals.totalUangMasuk,
              type: "inflow",
              subtitle: `${totals.validPaymentCount} dari ${totals.transactionCount} transaksi`,
            },
            {
              id: "uang-keluar",
              label: "Total Uang Keluar",
              value: totals.totalUangKeluar,
              type: "outflow",
              subtitle: `${totals.validExpenseCount} dari ${totals.transactionCount} transaksi`,
            },
            {
              id: "total-tagihan",
              label: "Total Tagihan",
              value: totals.totalTagihan,
              type: "neutral",
              subtitle: `${totals.validTagihanCount} dari ${totals.transactionCount} tagihan`,
            },
            {
              id: "cashback-pending",
              label: "Cashback Terpending",
              value: totals.totalCashbackTerpending,
              type: totals.totalCashbackTerpending > 0 ? "outflow" : "neutral",
              subtitle: `${totals.validCashbackCount} dari ${totals.transactionCount} transaksi`,
            },
          ]}
          columnsCount={4}
        />
      </div>

      {/* Invoice A5 Print Dialog */}
      <InvoiceA5Dialog
        open={!!printingItem}
        onOpenChange={(open) => {
          if (!open) setPrintingItem(null);
        }}
        data={printingItem}
      />

      {/* Permanent Hard Deletion Confirmation Dialog with "HAPUS DATA" Verification */}
      <AlertDialog
        open={!!deleteTargetItem}
        onOpenChange={(open) => {
          if (!open && !isSubmittingDelete) {
            setDeleteTargetItem(null);
            setDeleteConfirmText("");
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Hapus Data Penjualan Secara Permanen
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Menghapus data ini akan menghapus transaksi order, tagihan invoice, dan seluruh riwayat berkas terkait secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTargetItem && (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs my-2">
              <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Nomor Order:</span>
                <span className="font-mono font-semibold text-foreground">
                  {deleteTargetItem.orderNo || deleteTargetItem["Nomor Order"] || (deleteTargetItem.id?.startsWith("ord:") ? deleteTargetItem.id.slice(4) : "-")}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{deleteTargetItem["Nama Customer"] || deleteTargetItem.customer || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Nomor Polisi:</span>
                <span className="font-mono font-medium text-foreground">{deleteTargetItem["Plat No"] || deleteTargetItem.nopol || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Layanan:</span>
                <span className="font-medium text-foreground">{deleteTargetItem["Jenis Pengurusan"] || deleteTargetItem.layanan || "-"}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
              <span>Ketik &quot;HAPUS DATA&quot; untuk mengonfirmasi: <span className="text-destructive">*</span></span>
              {deleteConfirmText.trim() !== "HAPUS DATA" && (
                <span className="text-[10px] text-destructive font-normal">Wajib diketik sama persis</span>
              )}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                if (deleteError) setDeleteError(null);
              }}
              placeholder="HAPUS DATA"
              className={cn(
                "w-full px-3 py-2 rounded-md border text-xs font-mono tracking-wider uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1",
                deleteConfirmText.trim() !== "HAPUS DATA"
                  ? "border-destructive/60 bg-destructive/5 focus:ring-destructive"
                  : "border-emerald-500 bg-emerald-50/10 focus:ring-emerald-500"
              )}
            />
          </div>

          <ActionInlineError
            error={deleteError}
            actionKey="penjualan-delete"
            className="mt-2"
            onDismiss={() => setDeleteError(null)}
            onRetry={deleteConfirmText.trim() === "HAPUS DATA" ? handleConfirmDelete : undefined}
            isRetrying={isSubmittingDelete}
          />

          <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingDelete}
              onClick={() => {
                setDeleteTargetItem(null);
                setDeleteConfirmText("");
                setDeleteError(null);
              }}
              className="h-8 text-xs font-medium"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteConfirmText.trim() !== "HAPUS DATA" || isSubmittingDelete}
              onClick={handleConfirmDelete}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menghapus Permanen...
                </>
              ) : (
                "Hapus Permanen"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    );
  };

  return (
    <>
      {renderMainContent()}
      <MutationFeedbackDialog
        open={feedbackDialog.open}
        onClose={() => setFeedbackDialog((prev) => ({ ...prev, open: false }))}
        type={feedbackDialog.type}
        title={feedbackDialog.title}
        message={feedbackDialog.message}
        field={feedbackDialog.field}
        code={feedbackDialog.code}
      />
    </>
  );
}
