/**
 * Standardized Data Export Utilities (CSV & PDF/Printable Report)
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Features:
 * - Full Filtered Dataset Scope (Never limited to current pagination slice)
 * - Formula Injection Neutralization (Prepends ' to =, +, -, @)
 * - RFC 4180 Escaping (Handles commas, double quotes, and line breaks)
 * - UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
 * - Formal Landscape Print Report (A4 Landscape, repeated thead, metadata summary, page styling)
 */

export interface ExportColumn<T = any> {
  header: string;
  key?: string;
  format?: (row: T, index: number) => string | number | null | undefined;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface CSVExportOptions<T = any> {
  filename: string;
  columns: ExportColumn<T>[];
  data: T[];
}

export interface PDFExportOptions<T = any> {
  title: string;
  subtitle?: string;
  metadata?: { label: string; value: string }[];
  columns: ExportColumn<T>[];
  data: T[];
  companyName?: string;
}

/**
 * Neutralizes potential CSV/Formula Injection attacks.
 * Prepends a single apostrophe (') if a string begins with dangerous formula prefixes: =, +, -, @
 */
export function sanitizeCSVFormula(val: string): string {
  if (typeof val !== "string") return val;
  // If the string starts with =, +, -, or @ (with or without leading whitespace)
  if (/^\s*[=+\-@]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

/**
 * Escapes a cell value according to RFC 4180 specification.
 */
export function escapeCSVCell(rawVal: any): string {
  if (rawVal === null || rawVal === undefined) {
    return "";
  }
  let str = String(rawVal);
  // Neutralize formula injection
  str = sanitizeCSVFormula(str);

  // If the cell contains quotes, commas, carriage returns or newlines, quote it and escape internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports data to CSV with full filtered scope, RFC 4180 escaping, Formula Injection protection, and UTF-8 BOM.
 */
export function exportToCSV<T = any>({ filename, columns, data }: CSVExportOptions<T>): void {
  // 1. Build Header row
  const headerRow = columns.map((col) => escapeCSVCell(col.header)).join(",");

  // 2. Build Data rows
  const dataRows = data.map((row, rowIdx) => {
    return columns
      .map((col) => {
        let val: any;
        if (col.format) {
          val = col.format(row, rowIdx);
        } else if (col.key && col.key in (row as any)) {
          val = (row as any)[col.key];
        } else {
          val = "";
        }
        return escapeCSVCell(val);
      })
      .join(",");
  });

  const csvContent = [headerRow, ...dataRows].join("\r\n");

  // 3. Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an official, printable Landscape PDF report document.
 * Displays title, company brand, active filter metadata summary, total record count,
 * repeated table headers, and clean page breaks.
 */
export function exportToPrintablePDF<T = any>({
  title,
  subtitle,
  metadata = [],
  columns,
  data,
  companyName = "SUN BIRO JASA / ADMIN SUN89",
}: PDFExportOptions<T>): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Pop-up window diblokir oleh browser. Izinkan pop-up untuk mencetak / mengunduh PDF.");
  }

  const currentDate = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const metadataHtml = metadata
    .map(
      (m) => `
      <div class="meta-item">
        <span class="meta-label">${m.label}:</span>
        <span class="meta-value">${m.value}</span>
      </div>`
    )
    .join("");

  const headerCellsHtml = columns
    .map((col) => {
      const align = col.align || "left";
      const style = col.width ? `style="width: ${col.width}; text-align: ${align};"` : `style="text-align: ${align};"`;
      return `<th ${style}>${col.header}</th>`;
    })
    .join("");

  const rowsHtml = data.length > 0
    ? data
        .map((row, rowIdx) => {
          const cells = columns
            .map((col) => {
              let val: any;
              if (col.format) {
                val = col.format(row, rowIdx);
              } else if (col.key && col.key in (row as any)) {
                val = (row as any)[col.key];
              } else {
                val = "-";
              }
              const align = col.align || "left";
              const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
              return `<td class="${alignClass}">${val ?? "-"}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("")
    : `<tr><td colspan="${columns.length}" style="text-align: center; padding: 24px; color: #64748b;">Tidak ada data yang tersedia</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${companyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 11px;
      line-height: 1.4;
    }
    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .company-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #475569;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 2px 0;
      letter-spacing: -0.01em;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .header-right {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .meta-item {
      display: flex;
      gap: 4px;
      font-size: 10.5px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
      vertical-align: middle;
      word-break: break-word;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 600;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }
    .report-footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #64748b;
    }
    @media screen {
      .print-bar {
        background: #0f172a;
        color: white;
        padding: 10px 16px;
        margin: -16px -16px 16px -16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .print-btn {
        background: #2563eb;
        color: white;
        border: none;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 4px;
        cursor: pointer;
      }
      .print-btn:hover {
        background: #1d4ed8;
      }
    }
    @media print {
      .print-bar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>Pratinjau Dokumen Cetak / PDF — ${title}</span>
    <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>

  <div class="report-header">
    <div>
      <div class="company-title">${companyName}</div>
      <div class="doc-title">${title}</div>
      ${subtitle ? `<div class="doc-subtitle">${subtitle}</div>` : ""}
    </div>
    <div class="header-right">
      <div>Tanggal Cetak: <strong>${currentDate}</strong></div>
      <div>Total Data: <strong>${data.length} baris</strong></div>
    </div>
  </div>

  ${metadata.length > 0 ? `<div class="meta-box">${metadataHtml}</div>` : ""}

  <table>
    <thead>
      <tr>${headerCellsHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="report-footer">
    <div>Dokumen ini dicetak otomatis dari sistem operasional Admin SUN89.</div>
    <div>Dicetak pada: ${currentDate}</div>
  </div>

  <script>
    // Trigger print automatically after document loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
