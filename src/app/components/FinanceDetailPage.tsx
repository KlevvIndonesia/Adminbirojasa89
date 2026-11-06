import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Eye,
  Download,
  Car,
  Building2,
  FolderOpen,
  MapPin,
  Receipt,
  User,
  Phone,
  Calendar,
  Sparkles,
  Layers,
  History,
} from "lucide-react";
import {
  formatDateDDMMYYYY,
  formatRupiah,
  PlateNumberBadge,
  PlainTextStatus,
} from "../utils/financeFormatters";
import { orderRepository } from "../../data/repositories/orderRepository";
import { documentRepository } from "../../data/repositories/documentRepository";
import { deriveStatusPengerjaan, deriveStatusPembayaran } from "../data/penjualanContractData";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { downloadDataUrl } from "../utils/documentSvgGenerator";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import { toast } from "sonner";
import { cn } from "./ui/utils";
import { calculateInvoiceProfitMetrics } from "../../domain/finance/types";

interface FieldDef {
  key: string;
  label: string;
}

interface FinanceDetailPageProps {
  subTabTitle: string;
  item: any;
  columns?: FieldDef[];
  onBack: () => void;
  onEdit?: () => void;
}

export function FinanceDetailPage({
  subTabTitle,
  item,
  columns,
  onBack,
  onEdit,
}: FinanceDetailPageProps) {
  const navigate = useNavigate();
  const { setCustomHeader } = useNavigationGuard();

  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    title: string;
    rawUrl?: string;
    fileType?: string;
    documentId?: string;
  } | null>(null);

  if (!item) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground text-sm">Data transaksi tidak ditemukan</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Kembali
        </Button>
      </div>
    );
  }

  // Canonical order resolution (checks orderNo, "Nomor Order", "No Order", or ID prefixed with "ord:")
  const orderNo =
    item.orderNo ||
    item["Nomor Order"] ||
    item["No Order"] ||
    item.order_no ||
    (typeof item.id === "string" && item.id.startsWith("ord:")
      ? item.id.slice(4)
      : typeof item.id === "string" && item.id.toUpperCase().startsWith("ORD-")
      ? item.id
      : null);

  const canonicalOrder = orderNo ? orderRepository.getByOrderNo(orderNo) : null;
  const isProjectedOrder = Boolean(canonicalOrder);

  const [serverDocs, setServerDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!orderNo) return;
    let isMounted = true;
    documentRepository
      .getDocumentsByOrder(orderNo)
      .then((docs) => {
        if (isMounted && Array.isArray(docs)) {
          setServerDocs(docs);
        }
      })
      .catch((err) => {
        console.warn("[FinanceDetailPage] Could not fetch server documents:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [orderNo]);

  // Derive Canonical Service Name
  const rawService =
    item["Jenis Pengurusan"] ||
    canonicalOrder?.layanan ||
    item.layanan ||
    (subTabTitle && subTabTitle.replace(/^Data Penjualan\s*[-–—]\s*/i, "")) ||
    "Perpanjangan 1 Tahun";

  const serviceName = rawService.trim();
  const isMutasiService =
    serviceName.toLowerCase().includes("mutasi") ||
    (subTabTitle && subTabTitle.toLowerCase().includes("mutasi"));

  // Customer & Vehicle attributes
  const customerName = item["Nama Customer"] || canonicalOrder?.customer || item.customer || "-";
  const customerPhone = item["Nomor HP"] || item["No HP"] || canonicalOrder?.nomorHP || item.phone || "-";
  const namaPemilik = item["Nama Pemilik (STNK/BPKB)"] || canonicalOrder?.namaPemilik || item.namaPemilik || customerName;
  const platNo = item["Plat No"] || canonicalOrder?.nopol || item.nopol || "-";
  const r4r2 = item["R4 / R2"] || canonicalOrder?.jenisKendaraan || (canonicalOrder as any)?.r4_r2 || item.r4_r2 || "R4";
  const statusKepemilikan = item["Status Kepemilikan"] || canonicalOrder?.kepemilikanKendaraan || (canonicalOrder as any)?.statusKepemilikan || "Pribadi";
  const tanggalMasukBerkas = item["Tanggal Masuk Berkas"] || item.tanggalMasukBerkas || (canonicalOrder as any)?.tanggalOrder || canonicalOrder?.createdAt || item.tanggal || item["Tanggal"] || "-";

  // 9-Part Structured Address Attributes
  const pickup = canonicalOrder?.alamatPenjemputan;
  const detailAlamat = (item["Detail Alamat"] || item.detailAlamat || pickup?.detail || "").trim();
  const nomorRumah = (item["Nomor Rumah"] || item.nomorRumah || pickup?.nomor || "").trim();
  const rtRw = (item["RT/RW"] || item.rtRw || pickup?.rtRw || "").trim();
  const kelurahan = (item["Kelurahan/Desa"] || item.kelurahan || pickup?.kelurahan || "").trim();
  const kecamatan = (item["Kecamatan"] || item.kecamatan || pickup?.kecamatan || "").trim();
  const kota = (item["Kota/Kabupaten"] || item.kota || pickup?.kota || "").trim();
  const provinsi = (item["Provinsi"] || item.provinsi || (pickup as any)?.provinsi || "").trim();
  const patokan = (item["Patokan"] || item.patokan || pickup?.landmark || "").trim();
  const linkLokasi = (item["Link Lokasi"] || item.linkLokasi || pickup?.mapsUrl || "").trim();
  const compiledAlamat =
    item["Alamat"] ||
    item.alamat ||
    (canonicalOrder as any)?.alamat ||
    [
      detailAlamat,
      nomorRumah ? `No. ${nomorRumah}` : "",
      rtRw ? `RT/RW ${rtRw}` : "",
      kelurahan ? `Kel. ${kelurahan}` : "",
      kecamatan ? `Kec. ${kecamatan}` : "",
      kota,
      provinsi,
    ]
      .filter(Boolean)
      .join(", ");

  // Samsat Office Locations
  const samsatAsal =
    item["Samsat Asal"] ||
    item["Samsat"] ||
    canonicalOrder?.wilayahSamsatAsal ||
    "-";

  const samsatTujuan =
    item["Samsat Tujuan"] ||
    canonicalOrder?.wilayahSamsatTujuan ||
    (isMutasiService ? "-" : "- (Bukan Layanan Mutasi)");

  // Statuses & Documents
  const statusPengerjaan =
    item["Status Pengerjaan"] ||
    (canonicalOrder ? deriveStatusPengerjaan(canonicalOrder) : "Dalam Proses");

  const dokumenBPKB = item["Dokumen BPKB"] || item["BPKB"] || "Ada";
  const nomorTTB = item["Nomor TTB BPKB"] || item["TTB BPKB"] || "-";
  const tandaTerima = item["Tanda Terima"] || item["Nomor Tanda Terima"] || "-";
  const catatan = item["Keterangan"] || canonicalOrder?.catatanOrder || "-";

  // Financial Attributes (Supports canonical camelCase, snake_case, and localized label aliases)
  const biayaSamsat = Number(
    item["Biaya Pokok Samsat"] ??
      item.biayaPokokSamsat ??
      item.biayaSamsat ??
      item.biaya_samsat ??
      canonicalOrder?.pkb ??
      0
  );

  const biayaJasa = Number(
    item["Biaya Jasa"] ??
      (canonicalOrder?.payment as any)?.biayaJasa ??
      item.biayaJasa ??
      item.biaya_jasa ??
      0
  );

  const biayaAntarJemput = Number(
    item["Biaya Antar Jemput"] ??
      (canonicalOrder?.payment as any)?.biayaAntarJemput ??
      item.biayaAntarJemput ??
      item.biaya_antar_jemput ??
      0
  );

  const biayaLainnya = Number(
    item["Biaya Lainnya"] ??
      (canonicalOrder?.payment as any)?.biayaLainnya ??
      item.biayaLainnya ??
      item.biaya_lainnya ??
      0
  );

  const totalTagihan = Number(
    item["Total Tagihan Konsumen"] ??
      item.totalTagihan ??
      item.total_tagihan ??
      canonicalOrder?.payment?.totalBiaya ??
      item.totalBiaya ??
      item.nominal ??
      item["Total Tagihan"] ??
      (item.biayaSamsat !== undefined && (item.profit !== undefined || item.uangMasuk !== undefined) && item.totalTagihan === undefined
        ? Number(item.uangMasuk || 0)
        : (biayaSamsat + biayaJasa + biayaAntarJemput + biayaLainnya))
  );

  const uangMasuk = Number(
    item["Uang Masuk dari Konsumen"] ??
      item.uangMasuk ??
      item.dibayar ??
      item.terbayar ??
      canonicalOrder?.payment?.dibayar ??
      (canonicalOrder?.payment as any)?.sudahBayar ??
      item.sudahBayar ??
      (item["Status Pembayaran"] === "Lunas" || item.status === "Lunas" ? totalTagihan : 0)
  );

  const partnerCashback = Number(
    item.cashback ??
      item.cashback_nominal ??
      item["Komisi Rekanan"] ??
      (canonicalOrder as any)?.cashback ??
      (canonicalOrder as any)?.cashback_mitra ??
      0
  );

  const overpayment = Number(
    item.overpayment ??
      item.kelebihanBayar ??
      item["Kelebihan Bayar"] ??
      Math.max(0, uangMasuk - totalTagihan)
  );

  const sisaTagihan = Number(
    item["Sisa Tagihan"] ??
      item.sisa ??
      item.sisaTagihan ??
      Math.max(0, totalTagihan - uangMasuk)
  );

  const isExplicitZero = Boolean(
    item.isExplicitZero ||
    item.is_explicit_zero ||
    item.isZeroCostPromotion ||
    item.costClassification === "EXPLICIT_ZERO" ||
    (canonicalOrder as any)?.isExplicitZero
  );

  const profitMetrics = calculateInvoiceProfitMetrics({
    dibayar: uangMasuk,
    totalTagihan,
    biayaSamsat,
    biayaAntarJemput,
    cashback: partnerCashback,
    isExplicitZero,
  });

  const isDeficit =
    profitMetrics.isNetDeficit ||
    profitMetrics.isGrossDeficit ||
    (typeof item.profit === "number" && item.profit < 0) ||
    Boolean(item.isGrossDeficit) ||
    Boolean(item.isNetDeficit);

  const profit = isDeficit
    ? (profitMetrics.netTransactionMargin < 0
        ? profitMetrics.netTransactionMargin
        : typeof item.profit === "number" && item.profit < 0
        ? item.profit
        : profitMetrics.grossServiceMargin)
    : (profitMetrics.netTransactionMargin !== 0
        ? profitMetrics.netTransactionMargin
        : typeof item.profit === "number"
        ? item.profit
        : 0);
  const cashback = partnerCashback;

  const statusPembayaran =
    item["Status Pembayaran"] ||
    item.status ||
    item.statusPembayaran ||
    (canonicalOrder
      ? deriveStatusPembayaran(null, canonicalOrder)
      : sisaTagihan === 0 && (totalTagihan > 0 || isExplicitZero)
      ? "Lunas"
      : uangMasuk > 0
      ? "Kurang Bayar"
      : "Belum Bayar");

  const skemaPembayaran = item["Skema Pembayaran"] || item.skemaBayar || "Bayar di Awal";
  const noInvoice = item["No Invoice"] || item.noInvoice || (orderNo ? orderNo.replace(/^ORD-/, "INV-") : "-");

  // Payment channel details
  const tglUangMasuk = item["Tanggal Uang Masuk"] || item["Tanggal Masuk"] || item.tanggalMasuk || item.tanggalBayar || (canonicalOrder?.payment as any)?.tanggal || tanggalMasukBerkas;
  const metodeBayarMasuk = item["Metode Pembayaran Masuk"] || item.metodeBayarMasuk || "Transfer Bank";
  const bankMasuk = item["Bank Uang Masuk"] || item.bankMasuk || "BCA";
  const noRekMasuk = item["Nomor Rekening Pengirim"] || item["Nomor Rekening Masuk"] || item.noRekeningPengirim || "-";

  const tglUangKeluar = item["Tanggal Uang Keluar"] || item["Tanggal Keluar"] || item.tanggalKeluar || tanggalMasukBerkas;
  const metodeBayarKeluar = item["Metode Pembayaran Keluar"] || item.metodeBayarKeluar || "Kas Tunai";
  const bankKeluar = item["Bank Uang Keluar"] || item.bankKeluar || "-";
  const noRekKeluar = item["Nomor Rekening Penerima"] || item.noRekeningPenerima || "-";

  // Register Header Tunggal Terpadu (Unified App Shell Header)
  useEffect(() => {
    const headerTitle = `Detail Data Penjualan - ${serviceName}`;
    const headerSubtitle = `${orderNo || "-"} • ${customerName} • ${platNo}`;
    setCustomHeader({
      title: headerTitle,
      subtitle: headerSubtitle,
      showBackButton: true,
      onBack: onBack,
      hideBreadcrumbs: true,
    });
    return () => {
      setCustomHeader(null);
    };
  }, [serviceName, orderNo, customerName, platNo, onBack, setCustomHeader]);

  // Download helper for attached files
  const handleDownloadFile = (url?: string, filename?: string) => {
    if (!url) {
      toast.error("Tautan berkas tidak tersedia");
      return;
    }
    const cleanName = filename || "dokumen";
    if (url.startsWith("data:")) {
      downloadDataUrl(url, cleanName);
      toast.success(`Mengunduh ${cleanName}`);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanName;
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Build Inbound Documents (Dokumen Masuk dari Klien)
  const itemAwalDocs: any[] = Array.isArray(item.dokumenAwal) ? item.dokumenAwal : [];
  const clientDocs = canonicalOrder?.clientDocuments || {};
  const standardBeforeSlots = [
    { key: "stnk", label: "STNK Asli", item: clientDocs.stnk || clientDocs.STNK },
    { key: "bpkb", label: "BPKB Asli", item: clientDocs.bpkb || clientDocs.BPKB },
    { key: "ktp", label: "KTP Pemilik", item: clientDocs.ktp || clientDocs.KTP },
    { key: "skkp", label: "SKKP / Notice Pajak Asal", item: clientDocs.skkp || clientDocs.SKKP },
    { key: "kuasa", label: "Surat Kuasa Bermaterai", item: clientDocs.lainnya || clientDocs.LAINNYA },
  ];

  const canonicalBeforeDocs = [
    ...(canonicalOrder?.rekapDocuments?.filter(
      (d: any) =>
        d.phase === "BEFORE" ||
        d.phase === "INBOUND" ||
        (!d.phase && d.category !== "Dokumen Hasil")
    ) || []),
    ...((canonicalOrder as any)?.uploadedDocs?.filter(
      (d: any) =>
        d.phase === "BEFORE" ||
        d.phase === "INBOUND" ||
        (!d.phase && d.category !== "Dokumen Hasil")
    ) || []),
  ];

  const inboundList: Array<{
    id: string;
    label: string;
    name: string;
    fileUrl?: string;
    fileType?: string;
    formattedSize?: string;
    documentId?: string;
    isAvailable: boolean;
  }> = [];

  // 1. Add uploaded docs from item.dokumenAwal
  itemAwalDocs.forEach((doc, idx) => {
    const rawUrl = doc.fileUrl || doc.downloadUrl || (doc.id ? documentRepository.getPreviewUrl(doc.id) : undefined);
    inboundList.push({
      id: doc.id || `awal-${idx}`,
      label: doc.name || doc.label || `Dokumen Masuk #${idx + 1}`,
      name: doc.name || doc.label || `Dokumen Masuk #${idx + 1}`,
      fileUrl: rawUrl,
      fileType: doc.mimeType?.includes("pdf") ? "PDF" : "IMAGE",
      formattedSize: doc.formattedSize,
      documentId: doc.id,
      isAvailable: Boolean(rawUrl),
    });
  });

  // 2. Add canonical before docs (rekapDocuments phase BEFORE/INBOUND)
  canonicalBeforeDocs.forEach((doc: any, idx: number) => {
    const docName = doc.name || doc.label || doc.documentType || `Dokumen Masuk #${idx + 1}`;
    const alreadyExists = inboundList.some(
      (d) => d.name.toLowerCase() === docName.toLowerCase() || (doc.id && d.id === doc.id)
    );
    if (!alreadyExists) {
      const rawUrl = doc.fileUrl || (doc.id ? documentRepository.getPreviewUrl(doc.id) : undefined);
      inboundList.push({
        id: doc.id || `can-before-${idx}`,
        label: docName,
        name: doc.fileName || docName,
        fileUrl: rawUrl,
        fileType: (doc.fileType || (docName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE")).toUpperCase(),
        documentId: doc.id?.startsWith("doc-") ? undefined : doc.id,
        isAvailable: Boolean(rawUrl),
      });
    }
  });

  // 3. Add canonical clientDocs slots if real file is present
  standardBeforeSlots.forEach((slot) => {
    const hasDigital = Boolean(
      slot.item?.fileUrl &&
        slot.item?.name &&
        !slot.item.name.toLowerCase().includes("belum")
    );
    const alreadyExists = inboundList.some(
      (d) =>
        d.name.toLowerCase().includes(slot.key) ||
        d.label.toLowerCase().includes(slot.key)
    );
    if (!alreadyExists && hasDigital) {
      inboundList.push({
        id: slot.item?.documentId || slot.key,
        label: slot.label,
        name: slot.item?.name || slot.label,
        fileUrl: slot.item?.fileUrl,
        fileType:
          slot.item?.fileType?.toUpperCase() ||
          (slot.item?.name?.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE"),
        documentId: slot.item?.documentId,
        isAvailable: true,
      });
    }
  });

  // 4. Add server docs from SQLite order_documents where arah === 'MASUK'
  serverDocs
    .filter((sd) => {
      const arah = (sd.arahDokumen || sd.arah_dokumen || "").toUpperCase();
      const phase = sd.metadata?.phase || sd.phase;
      return (
        arah === "MASUK" ||
        phase === "BEFORE" ||
        phase === "INBOUND" ||
        sd.documentType === "DOKUMEN_MASUK" ||
        (!arah && !phase && sd.documentType !== "DOKUMEN_KELUAR")
      );
    })
    .forEach((doc) => {
      const docName = doc.originalName || doc.nama_file_asli || doc.fileName || doc.kategori_dokumen || doc.documentType || "Dokumen Masuk";
      const alreadyExists = inboundList.some(
        (d) => d.id === doc.id || d.name === docName
      );
      if (!alreadyExists) {
        const previewUrl = doc.fileUrl || documentRepository.getPreviewUrl(doc.id);
        inboundList.unshift({
          id: doc.id,
          label: doc.kategori_dokumen || doc.documentType || docName,
          name: docName,
          fileUrl: previewUrl,
          fileType: (doc.mimeType || doc.mime_type || "").includes("pdf") ? "PDF" : "IMAGE",
          formattedSize: doc.sizeBytes || doc.file_size ? `${Math.round((doc.sizeBytes || doc.file_size) / 1024)} KB` : undefined,
          documentId: doc.id,
          isAvailable: Boolean(previewUrl),
        });
      }
    });

  // Build Outbound Documents (Dokumen Keluar Hasil Jadi Samsat)
  const itemAkhirDocs: any[] = Array.isArray(item.dokumenAkhir) ? item.dokumenAkhir : [];
  const canonicalAfterDocs = [
    ...(canonicalOrder?.rekapDocuments?.filter(
      (d: any) =>
        d.phase === "AFTER" ||
        d.phase === "OUTBOUND" ||
        d.category === "Dokumen Hasil"
    ) || []),
    ...((canonicalOrder as any)?.uploadedDocs?.filter(
      (d: any) =>
        d.phase === "AFTER" ||
        d.phase === "OUTBOUND" ||
        d.category === "Dokumen Hasil"
    ) || []),
    ...(canonicalOrder?.deliveryHandover?.photoProofUrl
      ? [
          {
            id: "handover-proof",
            name: canonicalOrder.deliveryHandover.fileName || "Bukti Serah Terima",
            label: "Bukti Serah Terima",
            fileUrl: canonicalOrder.deliveryHandover.photoProofUrl,
            fileType: canonicalOrder.deliveryHandover.fileType || "IMAGE",
            status: "Dokumen Diserahkan",
          },
        ]
      : []),
  ];

  const outboundList: Array<{
    id: string;
    label: string;
    name: string;
    fileUrl?: string;
    fileType?: string;
    formattedSize?: string;
    documentId?: string;
    isAvailable: boolean;
  }> = [];

  // 1. Add uploaded docs from item.dokumenAkhir
  itemAkhirDocs.forEach((doc, idx) => {
    const rawUrl = doc.fileUrl || doc.downloadUrl || (doc.id ? documentRepository.getPreviewUrl(doc.id) : undefined);
    outboundList.push({
      id: doc.id || `akhir-${idx}`,
      label: doc.name || doc.label || `Dokumen Keluar #${idx + 1}`,
      name: doc.name || doc.label || `Dokumen Keluar #${idx + 1}`,
      fileUrl: rawUrl,
      fileType: doc.mimeType?.includes("pdf") ? "PDF" : "IMAGE",
      formattedSize: doc.formattedSize,
      documentId: doc.id,
      isAvailable: Boolean(rawUrl),
    });
  });

  // 2. Add canonical order after docs
  canonicalAfterDocs.forEach((doc: any, idx: number) => {
    const docName = doc.name || doc.label || doc.documentType || `Dokumen Hasil #${idx + 1}`;
    const alreadyExists = outboundList.some(
      (d) => d.name === docName || d.id === doc.id
    );
    if (!alreadyExists) {
      const rawUrl = doc.fileUrl || (doc.id ? documentRepository.getPreviewUrl(doc.id) : undefined);
      outboundList.push({
        id: doc.id || `can-after-${idx}`,
        label: docName,
        name: doc.fileName || docName,
        fileUrl: rawUrl,
        fileType: (doc.fileType || (docName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE")).toUpperCase(),
        documentId: doc.id?.startsWith("doc-") ? undefined : doc.id,
        isAvailable: Boolean(rawUrl),
      });
    }
  });

  // 3. Add server docs from SQLite order_documents where arah === 'KELUAR'
  serverDocs
    .filter((sd) => {
      const arah = (sd.arahDokumen || sd.arah_dokumen || "").toUpperCase();
      const phase = sd.metadata?.phase || sd.phase;
      return (
        arah === "KELUAR" ||
        phase === "AFTER" ||
        phase === "OUTBOUND" ||
        sd.documentType === "DOKUMEN_KELUAR"
      );
    })
    .forEach((doc) => {
      const docName = doc.originalName || doc.nama_file_asli || doc.fileName || doc.kategori_dokumen || doc.documentType || "Dokumen Keluar";
      const alreadyExists = outboundList.some(
        (d) => d.id === doc.id || d.name === docName
      );
      if (!alreadyExists) {
        const previewUrl = doc.fileUrl || documentRepository.getPreviewUrl(doc.id);
        outboundList.unshift({
          id: doc.id,
          label: doc.kategori_dokumen || doc.documentType || docName,
          name: docName,
          fileUrl: previewUrl,
          fileType: (doc.mimeType || doc.mime_type || "").includes("pdf") ? "PDF" : "IMAGE",
          formattedSize: doc.sizeBytes || doc.file_size ? `${Math.round((doc.sizeBytes || doc.file_size) / 1024)} KB` : undefined,
          documentId: doc.id,
          isAvailable: Boolean(previewUrl),
        });
      }
    });

  // Filter strictly to valid files
  const activeInboundList = inboundList.filter((d) => Boolean(d.fileUrl));
  const activeOutboundList = outboundList.filter((d) => Boolean(d.fileUrl));

  // Build rows for Tabel Faktur Transaksi
  const fakturItems: Array<{
    no: number;
    tanggal: string;
    item: string;
    kategori: "masuk" | "keluar" | "jasa" | "lainnya";
    metode: string;
    bank: string;
    noRek: string;
    nominal: number;
  }> = [
    {
      no: 1,
      tanggal: formatDateDDMMYYYY(tglUangMasuk),
      item: "Uang Masuk Konsumen",
      kategori: "masuk",
      metode: metodeBayarMasuk,
      bank: bankMasuk,
      noRek: noRekMasuk,
      nominal: uangMasuk,
    },
    {
      no: 2,
      tanggal: formatDateDDMMYYYY(tglUangKeluar),
      item: `Biaya Pokok Samsat (${samsatAsal})`,
      kategori: "keluar",
      metode: metodeBayarKeluar,
      bank: bankKeluar,
      noRek: noRekKeluar,
      nominal: biayaSamsat,
    },
    {
      no: 3,
      tanggal: formatDateDDMMYYYY(tglUangMasuk),
      item: "Biaya Jasa Kantor",
      kategori: "jasa",
      metode: metodeBayarMasuk,
      bank: bankMasuk,
      noRek: noRekMasuk,
      nominal: biayaJasa,
    },
  ];

  let nextNo = 4;
  if (biayaAntarJemput > 0) {
    fakturItems.push({
      no: nextNo++,
      tanggal: formatDateDDMMYYYY(tglUangMasuk),
      item: "Biaya Antar / Jemput",
      kategori: "lainnya",
      metode: metodeBayarMasuk,
      bank: bankMasuk,
      noRek: noRekMasuk,
      nominal: biayaAntarJemput,
    });
  }

  if (biayaLainnya > 0) {
    fakturItems.push({
      no: nextNo++,
      tanggal: formatDateDDMMYYYY(tglUangKeluar),
      item: "Biaya Lainnya",
      kategori: "lainnya",
      metode: metodeBayarKeluar,
      bank: bankKeluar,
      noRek: noRekKeluar,
      nominal: biayaLainnya,
    });
  }

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          SECTION 1: DATA BERKAS & ORDER (Read-Only Clean Presentation)
          ========================================================================= */}
      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Header Section 1 */}
        <div className="p-4 sm:p-5 border-b border-border/70 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  1. Informasi Berkas & Order
                </h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {orderNo || "-"}
                </span>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {serviceName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Data identitas pemesan, legalitas kendaraan, rincian alamat penjemputan, dan kantor Samsat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <PlainTextStatus status={statusPengerjaan} />
            {isProjectedOrder && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/order/tracking")}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lacak Order</span>
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                onClick={onEdit}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-semibold shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Ubah Data</span>
              </Button>
            )}
          </div>
        </div>

        {/* Content Section 1: Read-Only Grid */}
        <div className="p-4 sm:p-5 space-y-5">
          {/* Group A: Identitas Pemesan & Legalitas Kendaraan */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              Identitas Pemesan & Kendaraan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-muted/20 p-3.5 rounded-xl border border-border/60">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Nama Customer</span>
                <p className="font-semibold text-foreground text-sm">{customerName}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Nomor HP / WhatsApp</span>
                <p className="font-mono font-medium text-foreground text-sm">{customerPhone}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Plat Nomor Kendaraan</span>
                <div className="pt-0.5">
                  <PlateNumberBadge plate={platNo} />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Kategori & Kepemilikan</span>
                <p className="font-medium text-foreground text-sm">
                  {r4r2} • {statusKepemilikan}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Nama Legal di STNK / BPKB</span>
                <p className="font-medium text-foreground">{namaPemilik}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Tanggal Masuk Berkas</span>
                <p className="font-medium text-foreground font-mono">{formatDateDDMMYYYY(tanggalMasukBerkas)}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Samsat Asal</span>
                <p className="font-medium text-foreground">{samsatAsal}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Samsat Tujuan</span>
                <p className="font-medium text-foreground">{samsatTujuan}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Status Dokumen Fisik BPKB</span>
                <p className="font-medium text-foreground">{dokumenBPKB}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Nomor TTB BPKB</span>
                <p className="font-mono font-medium text-foreground">{nomorTTB}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Tanda Terima Berkas</span>
                <p className="font-mono font-medium text-foreground">{tandaTerima}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Catatan Khusus</span>
                <p className="font-medium text-foreground italic truncate" title={catatan}>{catatan}</p>
              </div>
            </div>
          </div>

          {/* Group B: 9-Part Structured Address */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Alamat Lengkap Pemilik / Penjemputan Berkas (9 Komponen)
              </h4>
              {linkLokasi && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(linkLokasi, "_blank", "noreferrer")}
                  className="h-6 text-[11px] border-primary/30 text-primary hover:bg-primary/10 gap-1 px-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Google Maps</span>
                </Button>
              )}
            </div>

            {compiledAlamat && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/70 text-xs text-foreground font-medium leading-relaxed">
                <span className="text-muted-foreground font-normal">Kompilasi Alamat: </span>
                {compiledAlamat}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs bg-muted/15 p-3 rounded-xl border border-border/50">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Provinsi</span>
                <p className="font-medium text-foreground truncate">{provinsi || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Kota / Kab</span>
                <p className="font-medium text-foreground truncate">{kota || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Kecamatan</span>
                <p className="font-medium text-foreground truncate">{kecamatan || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Kelurahan</span>
                <p className="font-medium text-foreground truncate">{kelurahan || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">RT / RW</span>
                <p className="font-mono font-medium text-foreground">{rtRw || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">No. Rumah</span>
                <p className="font-medium text-foreground">{nomorRumah || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Patokan</span>
                <p className="font-medium text-foreground truncate" title={patokan}>{patokan || "-"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Detail Jalan</span>
                <p className="font-medium text-foreground truncate" title={detailAlamat}>{detailAlamat || "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 2: TABEL FAKTUR TRANSAKSI & HASIL KEUANGAN
          ========================================================================= */}
      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Header Section 2 */}
        <div className="p-4 sm:p-5 border-b border-border/70 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  2. Rincian Keuangan & Faktur Tagihan
                </h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                  {noInvoice}
                </span>
                <Badge variant="outline" className="text-xs">
                  {skemaPembayaran}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buku besar perincian pos keuangan, penerimaan kas konsumen, biaya operasional Samsat, dan profit
              </p>
            </div>
          </div>

          {/* Status Pembayaran Badge & Akses Riwayat Audit Transaksi */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {(() => {
              let isSpvOrAdmin = false;
              try {
                const raw = localStorage.getItem("auth_user");
                if (raw) {
                  const r = JSON.parse(raw).role;
                  isSpvOrAdmin = r === "administrator" || r === "supervisor" || r === "spv" || r === "admin";
                }
              } catch {}
              if (isSpvOrAdmin) {
                return (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const searchKey = orderNo || noInvoice || "";
                      navigate(`/manajemen/riwayat-aktivitas?search=${encodeURIComponent(searchKey)}`);
                    }}
                    className="h-7 px-2.5 text-xs gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                    title="Buka Riwayat Aktivitas & jejak audit pembatalan (void) transaksi ini"
                  >
                    <History className="w-3.5 h-3.5 text-primary" />
                    <span>Riwayat Audit</span>
                  </Button>
                );
              }
              return null;
            })()}
            {(() => {
              let colorClasses = "bg-muted/40 text-muted-foreground border-border";
              if (statusPembayaran === "Lunas" || statusPembayaran === "LUNAS") {
                colorClasses = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
              } else if (statusPembayaran === "Kurang Bayar" || statusPembayaran === "KURANG BAYAR") {
                colorClasses = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
              } else if (statusPembayaran === "Kelebihan Bayar") {
                colorClasses = "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
              } else if (statusPembayaran === "Belum Bayar" || statusPembayaran === "BELUM BAYAR") {
                colorClasses = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";
              }

              return (
                <Badge variant="outline" className={cn("text-xs font-semibold px-3 py-1 shrink-0", colorClasses)}>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {statusPembayaran}
                </Badge>
              );
            })()}
          </div>
        </div>

        {/* Tabel Faktur Transaksi */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 text-center w-12">No</th>
                  <th className="py-3 px-3 w-28">Tanggal</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-3 w-36">Metode Pembayaran</th>
                  <th className="py-3 px-3 w-28">Bank</th>
                  <th className="py-3 px-3 w-40">Nomor Rekening</th>
                  <th className="py-3 px-4 text-right w-36">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {fakturItems.map((row) => (
                  <tr key={row.no} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-muted-foreground font-medium">
                      {row.no}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-foreground font-medium">
                      {row.tanggal}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        {row.kategori === "masuk" && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                        {row.kategori === "keluar" && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                        {row.kategori === "jasa" && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                        {row.kategori === "lainnya" && (
                          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                        )}
                        <span>{row.item}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-foreground">
                      <Badge variant="outline" className="text-[10px] font-normal px-2 py-0">
                        {row.metode}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {row.bank}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {row.noRek}
                    </td>
                    <td className={cn(
                      "py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-sm",
                      row.kategori === "masuk" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                    )}>
                      {formatRupiah(row.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HASIL RINGKASAN KEUANGAN (Executive Summary Footer) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {/* Total Uang Masuk */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300">
                Total Uang Masuk
              </span>
              <p className="font-mono font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatRupiah(uangMasuk)}
              </p>
            </div>

            {/* Total Tagihan */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Total Tagihan
              </span>
              <p className="font-mono font-bold text-sm sm:text-base text-foreground tabular-nums">
                {formatRupiah(totalTagihan)}
              </p>
            </div>

            {/* Sisa Tagihan */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Sisa Tagihan
              </span>
              {sisaTagihan === 0 && (totalTagihan > 0 || isExplicitZero) ? (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs pt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lunas (Rp 0)</span>
                </div>
              ) : (
                <p className={cn(
                  "font-mono font-bold text-sm sm:text-base tabular-nums",
                  sisaTagihan > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}>
                  {formatRupiah(sisaTagihan)}
                </p>
              )}
            </div>

            {/* Kelebihan Bayar */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Kelebihan Bayar
              </span>
              <p className={cn(
                "font-mono font-bold text-sm sm:text-base tabular-nums",
                overpayment > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"
              )}>
                {formatRupiah(overpayment)}
              </p>
            </div>

            {/* Estimasi Profit (Only if > 0 or Defisit) */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800 dark:text-indigo-300">
                Estimasi Profit
              </span>
              <p className={cn(
                "font-mono font-bold text-sm sm:text-base tabular-nums",
                isDeficit
                  ? "text-rose-600 dark:text-rose-400"
                  : (profit > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")
              )}>
                {isDeficit
                  ? `${formatRupiah(profit)} (Defisit)`
                  : (profit > 0 ? formatRupiah(profit) : formatRupiah(0))}
              </p>
            </div>

            {/* Status Pembayaran */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Status Pembayaran
              </span>
              <span className="font-bold text-xs text-foreground truncate">
                {statusPembayaran}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 3: DOKUMEN TRANSAKSI (DOKUMEN MASUK & DOKUMEN KELUAR)
          ========================================================================= */}
      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Header Section 3 */}
        <div className="p-4 sm:p-5 border-b border-border/70 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  3. Dokumen Transaksi (Masuk & Keluar)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Arsip berkas digital: Dokumen Masuk dari Klien (INBOUND) dan Dokumen Keluar Hasil Jadi Samsat (OUTBOUND)
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 shrink-0 self-start sm:self-center">
            {activeInboundList.length + activeOutboundList.length} Berkas Terlampir
          </Badge>
        </div>

        {/* Content Section 3: Dual Column Documents */}
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kolom 1: Dokumen Masuk dari Klien (INBOUND) */}
            <div className="p-4 rounded-xl border border-border bg-muted/15 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="font-semibold text-foreground flex items-center gap-2 text-xs">
                  <FileText className="w-4 h-4 text-primary" />
                  Dokumen Masuk dari Klien (INBOUND)
                </span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {activeInboundList.length} Berkas
                </Badge>
              </div>

              <div className="space-y-2">
                {activeInboundList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground italic space-y-1">
                    <p>Tidak ada dokumen masuk terlampir</p>
                    <p className="text-[10px]">Unggah berkas melalui menu Ubah Data</p>
                  </div>
                ) : (
                  activeInboundList.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold bg-primary/10 text-primary">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground text-xs truncate">
                              {doc.label}
                            </span>
                            {doc.fileType && (
                              <span className="px-1.5 py-0.2 rounded bg-muted text-[9px] font-mono text-muted-foreground uppercase">
                                {doc.fileType}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] truncate font-mono block text-muted-foreground">
                            {doc.name} {doc.formattedSize ? `• ${doc.formattedSize}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-border"
                          onClick={() => {
                            setPreviewDoc({
                              name: doc.name,
                              title: `Dokumen Masuk — ${doc.label}`,
                              rawUrl: doc.fileUrl,
                              fileType: doc.fileType,
                              documentId: doc.documentId,
                            });
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleDownloadFile(doc.fileUrl, doc.name)}
                          title="Unduh Berkas"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Kolom 2: Dokumen Keluar Hasil Jadi Samsat (OUTBOUND) */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="font-semibold text-foreground flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Dokumen Keluar Hasil Jadi (OUTBOUND)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {activeOutboundList.length} Berkas
                </Badge>
              </div>

              <div className="space-y-2">
                {activeOutboundList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground italic space-y-1">
                    <p>Tidak ada dokumen keluar terlampir</p>
                    <p className="text-[10px]">Hasil jadi Samsat akan muncul di sini</p>
                  </div>
                ) : (
                  activeOutboundList.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground text-xs truncate">
                              {doc.label}
                            </span>
                            {doc.fileType && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 uppercase">
                                {doc.fileType}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] truncate font-mono block text-muted-foreground">
                            {doc.name} {doc.formattedSize ? `• ${doc.formattedSize}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          onClick={() => {
                            setPreviewDoc({
                              name: doc.name,
                              title: `Dokumen Keluar — ${doc.label}`,
                              rawUrl: doc.fileUrl,
                              fileType: doc.fileType,
                              documentId: doc.documentId,
                            });
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleDownloadFile(doc.fileUrl, doc.name)}
                          title="Unduh Berkas"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Unified Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || "Preview Dokumen"}
        documentName={previewDoc?.name}
        rawUrl={previewDoc?.rawUrl}
        fileType={previewDoc?.fileType}
        documentId={previewDoc?.documentId}
      />
    </div>
  );
}
