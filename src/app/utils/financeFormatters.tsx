import React from "react";

const MONTH_NAMES_MAP: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

/**
 * Format any date string strictly to numeric DD/MM/YYYY (Requirement 9)
 * Example: 22/09/2026, 03/01/2026
 */
export function formatDateDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return "-";

  const trimmed = dateStr.trim();

  // Already DD/MM/YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const dd = day < 10 ? `0${day}` : `${day}`;
    const mm = month < 10 ? `0${month}` : `${month}`;
    return `${dd}/${mm}/${year}`;
  }

  // ISO format YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const dd = day < 10 ? `0${day}` : `${day}`;
    const mm = month < 10 ? `0${month}` : `${month}`;
    return `${dd}/${mm}/${year}`;
  }

  // Indonesian written date: e.g. "12 Januari 2026" or "12 Jan 2026"
  const textDateMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const monthWord = textDateMatch[2].toLowerCase();
    const year = parseInt(textDateMatch[3], 10);
    if (MONTH_NAMES_MAP[monthWord] !== undefined) {
      const month = MONTH_NAMES_MAP[monthWord] + 1;
      const dd = day < 10 ? `0${day}` : `${day}`;
      const mm = month < 10 ? `0${month}` : `${month}`;
      return `${dd}/${mm}/${year}`;
    }
  }

  // Standard Date parse fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const month = parsed.getMonth() + 1;
    const year = parsed.getFullYear();
    const dd = day < 10 ? `0${day}` : `${day}`;
    const mm = month < 10 ? `0${month}` : `${month}`;
    return `${dd}/${mm}/${year}`;
  }

  return "-";
}

// Alias for backwards compatibility if needed
export const formatDateIndonesian = formatDateDDMMYYYY;

/**
 * Parse any date string into numeric timestamp for accurate sorting (Requirement 10)
 */
export function parseDateTimestamp(dateStr: string | null | undefined): number {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return 0;

  const trimmed = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Indonesian text format
  const textDateMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const monthWord = textDateMatch[2].toLowerCase();
    const year = parseInt(textDateMatch[3], 10);
    if (MONTH_NAMES_MAP[monthWord] !== undefined) {
      return new Date(year, MONTH_NAMES_MAP[monthWord], day).getTime();
    }
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/**
 * Format currency to Indonesian Rupiah standard
 */
export function formatRupiah(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) return "Rp 0";
  const abs = Math.abs(amount).toLocaleString("id-ID");
  return amount < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
}

/**
 * Known proper entities & acronyms that should maintain exact capitalization (Requirements 6, 7, 8)
 */
const KNOWN_ACRONYMS = new Set([
  "PT",
  "PT.",
  "CV",
  "CV.",
  "UD",
  "UD.",
  "BCA",
  "BRI",
  "BNI",
  "CIMB",
  "STNK",
  "BPKB",
  "TTB",
  "INV",
  "LD",
  "AS",
  "BBN",
  "R4",
  "R2",
  "PDAM",
  "CNAF"
]);

/**
 * Helper to convert arbitrary string into Sentence case while preserving acronyms
 */
export function toSentenceCase(text: string | null | undefined): string {
  if (!text || text === "-") return "-";
  const str = String(text).trim();
  if (str === "") return "-";

  const words = str.split(/\s+/);
  return words
    .map((word, index) => {
      // Remove punctuation for check
      const clean = word.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (KNOWN_ACRONYMS.has(clean) || KNOWN_ACRONYMS.has(word.toUpperCase())) {
        return word.toUpperCase();
      }
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/**
 * Format Customer name in Sentence case while preserving entity prefixes (Requirement 7)
 * e.g. "CNAF KEL. GADING" -> "Cnaf kel. Gading"
 * "PT. MAJU JAYA" -> "PT. Maju Jaya"
 */
export function formatCustomerName(name: string | null | undefined): string {
  if (!name || name === "-") return "-";
  const words = String(name).trim().split(/\s+/);

  return words
    .map((word) => {
      const upper = word.toUpperCase();
      const cleanUpper = word.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (KNOWN_ACRONYMS.has(upper) || KNOWN_ACRONYMS.has(cleanUpper)) {
        return upper;
      }
      // Capitalize first letter of each major word in a customer name/business name
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Format Berkas name in Sentence case while preserving proper entities (Requirement 8)
 * e.g. "AHMAD YUSUF AL MAJID" -> "Ahmad Yusuf Al Majid"
 * "PT. GLOBAL INDONESIA" -> "PT. Global Indonesia"
 */
export function formatBerkasName(name: string | null | undefined): string {
  if (!name || name === "-") return "-";
  const words = String(name).trim().split(/\s+/);

  return words
    .map((word) => {
      const upper = word.toUpperCase();
      const cleanUpper = word.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (KNOWN_ACRONYMS.has(upper) || KNOWN_ACRONYMS.has(cleanUpper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Plate Number Badge (Monospace / distinct identifier typography) (Requirement 22)
 */
export function PlateNumberBadge({ plate }: { plate: string }) {
  if (!plate || plate === "-") return <span>-</span>;
  return (
    <span className="finance-table__plate font-mono text-[10px] font-semibold tracking-wider uppercase text-foreground">
      {plate.toUpperCase()}
    </span>
  );
}

/**
 * Status as PLAIN TEXT without badges, pills, dots, or background containers (Requirements 7, 8, 20)
 * Kas Kantor: Debit, Kredit -> plain neutral text
 * Tagihan: Lunas, Belum lunas -> plain neutral text
 * General: Clean sentence case plain text
 */
export function PlainTextStatus({ status }: { status: string | null | undefined }) {
  if (!status || status === "-" || String(status).trim() === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  const raw = String(status).trim();
  const s = raw.toLowerCase();

  // Debit / Kredit (Kas Kantor - Requirement 7): Pure neutral text, no bullet, dot, badge, pill, or background
  if (s === "debit" || s === "kredit") {
    return (
      <span className="text-[10px] font-normal text-foreground whitespace-nowrap">
        {s === "debit" ? "Debit" : "Kredit"}
      </span>
    );
  }

  // Canonical Financial & Payment Statuses (Separated authoritatively)
  if (s === "lunas") {
    return (
      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        Lunas
      </span>
    );
  }

  if (s === "kurang bayar") {
    return (
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
        Kurang Bayar
      </span>
    );
  }

  if (s === "belum bayar" || s === "belum lunas") {
    return (
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
        Belum Bayar
      </span>
    );
  }

  if (s === "belum & kurang bayar") {
    return (
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
        Belum & Kurang Bayar
      </span>
    );
  }

  if (s === "profit terpending" || s === "profit pending") {
    return (
      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
        Profit Terpending
      </span>
    );
  }

  if (s === "cashback terpending" || s === "cashback pending") {
    return (
      <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
        Cashback Terpending
      </span>
    );
  }

  if (s === "dibatalkan" || s === "batal") {
    return (
      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
        Dibatalkan
      </span>
    );
  }

  // Phase 9.1: Canonical Dual Status Title Case formatting
  const CANONICAL_MAP: Record<string, string> = {
    "dalam proses": "Dalam Proses",
    "menunggu arsip": "Menunggu Arsip",
    "selesai": "Selesai",
    "kelebihan bayar": "Kelebihan Bayar",
    "tagihan tidak tersedia": "Tagihan Tidak Tersedia",
  };

  if (CANONICAL_MAP[s]) {
    return (
      <span className="text-[10px] font-normal text-foreground whitespace-nowrap">
        {CANONICAL_MAP[s]}
      </span>
    );
  }

  // Tagihan Status (Requirement 8): "Lunas", "Belum Lunas" plain text
  if (s.includes("belum lunas") || s.includes("belum bayar")) {
    return (
      <span className="text-[10px] font-normal text-foreground whitespace-nowrap">
        Belum Lunas
      </span>
    );
  }

  // General Status (Requirement 6 & 20): Plain regular text
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <span className="text-[10px] font-normal text-foreground whitespace-nowrap">
      {label}
    </span>
  );
}

// Alias for backwards compatibility
export const FinanceStatusBadge = PlainTextStatus;

/**
 * Konversi nominal angka ke format teks terbilang bahasa Indonesia resmi.
 * Contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function angkaKeTerbilang(nilai: number): string {
  const bilangan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  const num = Math.floor(Math.abs(nilai));

  if (num === 0) return "Nol Rupiah";

  function sebut(n: number): string {
    if (n < 12) return bilangan[n];
    if (n < 20) return sebut(n - 10) + " Belas";
    if (n < 100) return sebut(Math.floor(n / 10)) + " Puluh " + (n % 10 > 0 ? sebut(n % 10) : "");
    if (n < 200) return "Seratus " + (n - 100 > 0 ? sebut(n - 100) : "");
    if (n < 1000) return sebut(Math.floor(n / 100)) + " Ratus " + (n % 100 > 0 ? sebut(n % 100) : "");
    if (n < 2000) return "Seribu " + (n - 1000 > 0 ? sebut(n - 1000) : "");
    if (n < 1000000) return sebut(Math.floor(n / 1000)) + " Ribu " + (n % 1000 > 0 ? sebut(n % 1000) : "");
    if (n < 1000000000) return sebut(Math.floor(n / 1000000)) + " Juta " + (n % 1000000 > 0 ? sebut(n % 1000000) : "");
    if (n < 1000000000000) return sebut(Math.floor(n / 1000000000)) + " Miliar " + (n % 1000000000 > 0 ? sebut(n % 1000000000) : "");
    return sebut(Math.floor(n / 1000000000000)) + " Triliun " + (n % 1000000000000 > 0 ? sebut(n % 1000000000000) : "");
  }

  const hasil = sebut(num).replace(/\s+/g, " ").trim();
  return `${hasil} Rupiah`;
}
