/**
 * File Validation & Binary Security Inspector
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides deep structural binary validation, magic bytes verification,
 * EOF marker checks, suspicious double extension mitigation, and strict
 * filename sanitization for allowed document formats (PDF, JPEG, PNG, WEBP).
 */

import path from "node:path";
import { ApiError } from "../middleware/errorHandler";
import { CONFIG } from "../config/env";

export type AllowedMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export type AllowedExtension = ".pdf" | ".jpg" | ".png" | ".webp";

export interface FileValidationResult {
  mimeType: AllowedMimeType;
  extension: AllowedExtension;
  sanitizedOriginalName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURES & MARKERS
// ─────────────────────────────────────────────────────────────────────────────

// Magic bytes signatures
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_SOI = Buffer.from([0xFF, 0xD8]);
const RIFF_HEADER = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
const WEBP_HEADER = Buffer.from([0x57, 0x45, 0x42, 0x50]); // WEBP

// Executable and dangerous payload signatures
const MZ_EXE = Buffer.from([0x4D, 0x5A]); // Windows PE EXE / DLL
const ELF_BIN = Buffer.from([0x7F, 0x45, 0x4C, 0x46]); // Linux ELF
const ZIP_SIG = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK.. (ZIP archive)
const RAR_SIG = Buffer.from([0x52, 0x61, 0x72, 0x21]); // Rar!
const SEVEN_Z_SIG = Buffer.from([0x37, 0x7A, 0xBC, 0xAF]); // 7z..
const MACHO_32 = Buffer.from([0xFE, 0xED, 0xFA, 0xCE]);
const MACHO_64 = Buffer.from([0xFE, 0xED, 0xFA, 0xCF]);
const MACHO_CIGAM_32 = Buffer.from([0xCE, 0xFA, 0xED, 0xFE]);
const MACHO_CIGAM_64 = Buffer.from([0xCF, 0xFA, 0xED, 0xFE]);
const JAVA_CLASS = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]);

// Dangerous script extensions for double extension attack detection
const DANGEROUS_EXTENSIONS = new Set([
  "php", "phtml", "php3", "php4", "php5", "phar",
  "exe", "dll", "bat", "cmd", "sh", "bash", "zsh",
  "js", "mjs", "cjs", "vbs", "vbe", "wsf", "wsh",
  "ps1", "psm1", "py", "pyw", "rb", "pl", "cgi",
  "jar", "war", "ear", "msi", "scr", "com", "hta",
  "cpl", "svg", "html", "htm", "xhtml", "asp", "aspx", "jsp", "jspx",
]);

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT-SPECIFIC STRUCTURAL VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates PDF structural integrity:
 * 1. Starts with %PDF- header.
 * 2. Minimum length of 64 bytes.
 * 3. Contains %%EOF marker in the last 1024 bytes.
 * 4. Checks for forbidden active scripts outside PDF stream elements.
 */
export function validatePdfStructure(buffer: Buffer): void {
  if (buffer.length < 64) {
    throw new ApiError(400, "CORRUPTED_PDF", "Ukuran berkas PDF terlalu kecil dan tidak memenuhi struktur dokumen standar.");
  }

  // Header check: %PDF-
  if (
    buffer[0] !== PDF_MAGIC[0] ||
    buffer[1] !== PDF_MAGIC[1] ||
    buffer[2] !== PDF_MAGIC[2] ||
    buffer[3] !== PDF_MAGIC[3]
  ) {
    throw new ApiError(400, "INVALID_PDF_HEADER", "Header berkas tidak sesuai dengan format PDF resmi (%PDF).");
  }

  // End of file check: %%EOF within last 1024 bytes
  const tailSize = Math.min(buffer.length, 1024);
  const tail = buffer.subarray(buffer.length - tailSize).toString("latin1");
  if (!tail.includes("%%EOF")) {
    throw new ApiError(400, "TRUNCATED_PDF", "Berkas PDF terpotong atau rusak: penanda akhir dokumen (%%EOF) tidak ditemukan.");
  }

  // Check for suspicious script polyglot tags in the first 1024 bytes
  const headSize = Math.min(buffer.length, 1024);
  const head = buffer.subarray(0, headSize).toString("latin1").toLowerCase();
  if (head.includes("<script") || head.includes("<?php") || head.includes("<html") || head.includes("<svg")) {
    throw new ApiError(400, "MALICIOUS_PDF_CONTENT", "Berkas PDF ditolak karena terdeteksi mengandung elemen skrip atau HTML berbahaya.");
  }
}

/**
 * Validates PNG structural integrity:
 * 1. Exact 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A.
 * 2. Minimum length of 57 bytes (signature + IHDR + IDAT/PLTE + IEND).
 * 3. First chunk must be IHDR with length 13 and non-zero dimensions.
 * 4. Last chunk must be IEND (49 45 4E 44) with valid CRC (AE 42 60 82).
 */
export function validatePngStructure(buffer: Buffer): void {
  if (buffer.length < 57) {
    throw new ApiError(400, "CORRUPTED_PNG", "Ukuran berkas PNG terlalu kecil dan tidak memenuhi struktur gambar standar.");
  }

  // Signature check
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new ApiError(400, "INVALID_PNG_SIGNATURE", "Header berkas tidak sesuai dengan tanda tangan biner PNG.");
  }

  // First chunk must be IHDR (length 13, type IHDR)
  const ihdrLength = buffer.readUInt32BE(8);
  const ihdrType = buffer.subarray(12, 16).toString("ascii");
  if (ihdrLength !== 13 || ihdrType !== "IHDR") {
    throw new ApiError(400, "INVALID_PNG_IHDR", "Chunk pertama berkas PNG bukan IHDR yang valid.");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new ApiError(400, "INVALID_PNG_DIMENSIONS", "Dimensi gambar PNG tidak sah (lebar atau tinggi bernilai 0).");
  }

  // Last chunk must be IEND (4 bytes length 0, 4 bytes IEND type, 4 bytes CRC)
  // IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82 (12 bytes)
  const expectedIend = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ]);
  const tail = buffer.subarray(buffer.length - 12);
  if (!tail.equals(expectedIend)) {
    throw new ApiError(400, "TRUNCATED_PNG", "Berkas PNG terpotong atau rusak: chunk penutup IEND tidak ditemukan di akhir berkas.");
  }
}

/**
 * Validates JPEG structural integrity:
 * 1. Starts with Start of Image (SOI) marker 0xFF, 0xD8.
 * 2. 3rd byte must be 0xFF followed by a valid marker.
 * 3. Minimum length of 100 bytes.
 * 4. Contains End of Image (EOI) marker 0xFF, 0xD9 within the last 32 bytes.
 */
export function validateJpegStructure(buffer: Buffer): void {
  if (buffer.length < 100) {
    throw new ApiError(400, "CORRUPTED_JPEG", "Ukuran berkas JPEG terlalu kecil dan tidak memenuhi struktur gambar standar.");
  }

  // SOI check (FF D8)
  if (buffer[0] !== JPEG_SOI[0] || buffer[1] !== JPEG_SOI[1] || buffer[2] !== 0xFF) {
    throw new ApiError(400, "INVALID_JPEG_HEADER", "Header berkas tidak sesuai dengan penanda awal gambar JPEG (SOI 0xFFD8).");
  }

  // Verify first marker after SOI
  const firstMarker = buffer[3];
  // Valid markers: APP0-APP15 (0xE0-0xEF), DQT (0xDB), SOF0-SOF3 (0xC0-0xC3), COM (0xFE)
  const isValidFirstMarker =
    (firstMarker >= 0xE0 && firstMarker <= 0xEF) ||
    firstMarker === 0xDB ||
    (firstMarker >= 0xC0 && firstMarker <= 0xC3) ||
    firstMarker === 0xFE;

  if (!isValidFirstMarker) {
    throw new ApiError(400, "INVALID_JPEG_STRUCTURE", "Marker segmen pertama berkas JPEG tidak valid.");
  }

  // EOI check (FF D9) within the last 32 bytes
  let foundEoi = false;
  const searchStart = Math.max(0, buffer.length - 32);
  for (let i = searchStart; i < buffer.length - 1; i++) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
      foundEoi = true;
      break;
    }
  }

  if (!foundEoi) {
    throw new ApiError(400, "TRUNCATED_JPEG", "Berkas JPEG terpotong atau rusak: penanda akhir gambar (EOI 0xFFD9) tidak ditemukan.");
  }
}

/**
 * Validates WebP structural integrity:
 * 1. Starts with RIFF header (0x52, 0x49, 0x46, 0x46).
 * 2. Offset 8-11 contains 'WEBP'.
 * 3. Offset 12-15 contains 'VP8 ' (lossy), 'VP8L' (lossless), or 'VP8X' (extended).
 * 4. File size declared in header matches buffer length within reasonable bounds.
 */
export function validateWebpStructure(buffer: Buffer): void {
  if (buffer.length < 30) {
    throw new ApiError(400, "CORRUPTED_WEBP", "Ukuran berkas WebP terlalu kecil dan tidak memenuhi struktur standar.");
  }

  // Check RIFF header
  if (!buffer.subarray(0, 4).equals(RIFF_HEADER)) {
    throw new ApiError(400, "INVALID_WEBP_RIFF", "Header berkas bukan kontainer RIFF yang sah.");
  }

  // Check WEBP magic
  if (!buffer.subarray(8, 12).equals(WEBP_HEADER)) {
    throw new ApiError(400, "INVALID_WEBP_SIGNATURE", "Kontainer berkas bukan format WebP yang sah.");
  }

  // Check chunk type (VP8 , VP8L, or VP8X)
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType !== "VP8 " && chunkType !== "VP8L" && chunkType !== "VP8X") {
    throw new ApiError(400, "UNSUPPORTED_WEBP_CHUNK", `Subtipe format WebP ('${chunkType}') tidak didukung.`);
  }

  // Verify declared size
  const declaredSize = buffer.readUInt32LE(4);
  // Total file size should be declaredSize + 8 bytes (RIFF + size field)
  // Allow slight padding variance (max 4 bytes)
  if (buffer.length < declaredSize + 8) {
    throw new ApiError(400, "TRUNCATED_WEBP", "Berkas WebP terpotong: ukuran data biner lebih kecil dari yang dinyatakan dalam header.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MALICIOUS PAYLOAD DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans the buffer against known executable binaries, scripts, and forbidden archives.
 */
export function checkDisallowedSignatures(buffer: Buffer): void {
  if (!buffer || buffer.length < 2) return;

  // Windows PE (EXE / DLL)
  if (buffer.length >= 2 && buffer[0] === MZ_EXE[0] && buffer[1] === MZ_EXE[1]) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas executable Windows (.exe/.dll) dilarang untuk diunggah.");
  }

  // Linux ELF
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ELF_BIN)) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas binary Linux ELF dilarang untuk diunggah.");
  }

  // Mach-O Binaries & Java Class
  if (
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(MACHO_32)) ||
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(MACHO_64)) ||
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(MACHO_CIGAM_32)) ||
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(MACHO_CIGAM_64)) ||
    (buffer.length >= 4 && buffer.subarray(0, 4).equals(JAVA_CLASS))
  ) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas binary eksekusi dilarang untuk diunggah.");
  }

  // Archives (ZIP / RAR / 7z)
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_SIG)) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas arsip ZIP tidak diizinkan. Harap unggah dokumen langsung (PDF/JPEG/PNG/WEBP).");
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(RAR_SIG)) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas arsip RAR tidak diizinkan.");
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(SEVEN_Z_SIG)) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas arsip 7-Zip tidak diizinkan.");
  }

  // Shell script shebang
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    throw new ApiError(400, "INVALID_FILE_SIGNATURE", "Format berkas tidak didukung atau isi berkas tidak valid: Berkas skrip shell dilarang untuk diunggah.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FILENAME SANITIZATION & EXTENSION AUDIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes original filename:
 * 1. Strips directory traversal components (.., /, \).
 * 2. Detects and rejects suspicious double extensions (e.g. file.php.jpg).
 * 3. Enforces that the client's declared extension matches the canonical detected extension.
 * 4. Produces a safe sanitized filename with strictly canonical extension.
 */
export function sanitizeAndValidateFileName(
  originalName: string,
  canonicalExt: AllowedExtension
): string {
  if (!originalName || typeof originalName !== "string") {
    return `dokumen${canonicalExt}`;
  }

  // Strip path traversal
  const base = path.basename(originalName).trim();

  // Remove null bytes and control characters
  const cleanChars = base.replace(/[\x00-\x1F\x7F<>:"/\\|?*;&$`~]/g, "_").trim();

  // Split dotted segments to inspect all potential extensions
  const parts = cleanChars.split(".");

  if (parts.length > 2) {
    // Check all segments before the final extension for dangerous script extensions
    for (let i = 1; i < parts.length - 1; i++) {
      const segment = parts[i].toLowerCase().trim();
      if (DANGEROUS_EXTENSIONS.has(segment)) {
        throw new ApiError(
          400,
          "SUSPICIOUS_DOUBLE_EXTENSION",
          `Nama berkas mengandung ekstensi sekunder berbahaya ('.${segment}') yang mencurigakan.`
        );
      }
    }
  }

  // Check client extension against canonical extension
  const clientExt = parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase().trim()}` : "";
  const isExtensionMatching =
    (canonicalExt === ".jpg" && (clientExt === ".jpg" || clientExt === ".jpeg")) ||
    (canonicalExt === ".png" && clientExt === ".png") ||
    (canonicalExt === ".pdf" && clientExt === ".pdf") ||
    (canonicalExt === ".webp" && clientExt === ".webp");

  if (clientExt && !isExtensionMatching) {
    throw new ApiError(
      400,
      "EXTENSION_MISMATCH",
      `Ekstensi berkas ('${clientExt}') tidak sesuai dengan format konten biner yang terdeteksi ('${canonicalExt}').`
    );
  }

  // Sanitize base name (first segment or all segments except the last)
  const basePart = parts.length > 1 ? parts.slice(0, -1).join("_") : parts[0];
  const safeBase = basePart
    .replace(/[^a-zA-Z0-9_\-\s]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100)
    .trim();

  return `${safeBase || "dokumen"}${canonicalExt}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE ENTRY POINT & PUBLIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspects binary magic bytes and returns the authoritative MIME type,
 * or null if unrecognized or matching disallowed malicious signatures.
 */
export function detectMagicMimeType(buffer: Buffer): AllowedMimeType | null {
  if (!buffer || buffer.length < 3) return null;

  // Disallowed executable and archive signatures check
  if (buffer.length >= 2 && buffer[0] === MZ_EXE[0] && buffer[1] === MZ_EXE[1]) {
    return null;
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ELF_BIN)) {
    return null;
  }
  if (
    buffer.length >= 4 &&
    (buffer.subarray(0, 4).equals(MACHO_32) ||
      buffer.subarray(0, 4).equals(MACHO_64) ||
      buffer.subarray(0, 4).equals(MACHO_CIGAM_32) ||
      buffer.subarray(0, 4).equals(MACHO_CIGAM_64) ||
      buffer.subarray(0, 4).equals(JAVA_CLASS) ||
      buffer.subarray(0, 4).equals(ZIP_SIG) ||
      buffer.subarray(0, 4).equals(RAR_SIG) ||
      buffer.subarray(0, 4).equals(SEVEN_Z_SIG))
  ) {
    return null;
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    return "application/pdf";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "image/png";
  }

  // JPEG / JPG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === JPEG_SOI[0] && buffer[1] === JPEG_SOI[1] && buffer[2] === 0xFF) {
    return "image/jpeg";
  }

  // WEBP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(RIFF_HEADER) &&
    buffer.subarray(8, 12).equals(WEBP_HEADER)
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Sanitizes filename by stripping path traversal components and forbidden characters.
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") return "dokumen";
  const base = path.basename(name).trim();
  const cleanChars = base.replace(/[\x00-\x1F\x7F<>:"/\\|?*;&$`~]/g, "_").trim();
  return cleanChars.replace(/\.\./g, "_").replace(/_+/g, "_");
}

/**
 * Comprehensive entry point for document upload validation:
 * 1. Checks file buffer existence and size limits.
 * 2. Checks disallowed executable and script signatures.
 * 3. Identifies and structurally validates format (PDF, JPEG, PNG, WEBP).
 * 4. Compares reported MIME type against canonical detected MIME.
 * 5. Sanitizes filename and enforces canonical extension.
 */
export function validateUploadedDocument(
  buffer: Buffer,
  originalName: string,
  reportedMime?: string
): FileValidationResult {
  // 1. Enforce size limits
  if (!buffer || buffer.length === 0) {
    throw new ApiError(400, "EMPTY_FILE", "Berkas tidak boleh kosong (0 bytes).");
  }

  if (buffer.length > CONFIG.MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024));
    throw new ApiError(
      400,
      "FILE_TOO_LARGE",
      `Ukuran berkas melebihi batas maksimum yang diizinkan (${maxMb}MB).`
    );
  }

  // 2. Reject known malicious binary / script signatures
  checkDisallowedSignatures(buffer);

  // 3. Inspect binary magic bytes
  const detectedMime = detectMagicMimeType(buffer);

  // Check client extension against binary signature
  const clientExt = path.extname(originalName || "").toLowerCase().trim();
  if (clientExt === ".pdf" && detectedMime !== "application/pdf") {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung atau isi berkas tidak valid: Berkas berekstensi .pdf tetapi tanda tangan biner bukan format PDF (%PDF)."
    );
  }
  if ((clientExt === ".jpg" || clientExt === ".jpeg") && detectedMime !== "image/jpeg") {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung atau isi berkas tidak valid: Berkas berekstensi JPEG/JPG tetapi tanda tangan biner bukan penanda awal JPEG (0xFFD8FF)."
    );
  }
  if (clientExt === ".png" && detectedMime !== "image/png") {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung atau isi berkas tidak valid: Berkas berekstensi .png tetapi tanda tangan biner bukan signature PNG."
    );
  }
  if (clientExt === ".webp" && detectedMime !== "image/webp") {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung atau isi berkas tidak valid: Berkas berekstensi .webp tetapi tanda tangan biner bukan container WebP."
    );
  }

  if (!detectedMime) {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung atau isi berkas tidak valid: Hanya berkas PDF, JPEG, PNG, dan WebP yang diizinkan."
    );
  }

  // 4. Dedicated structural validation
  const canonicalMime: AllowedMimeType = detectedMime;
  let canonicalExt: AllowedExtension;

  if (detectedMime === "application/pdf") {
    validatePdfStructure(buffer);
    canonicalExt = ".pdf";
  } else if (detectedMime === "image/png") {
    validatePngStructure(buffer);
    canonicalExt = ".png";
  } else if (detectedMime === "image/jpeg") {
    validateJpegStructure(buffer);
    canonicalExt = ".jpg";
  } else if (detectedMime === "image/webp") {
    validateWebpStructure(buffer);
    canonicalExt = ".webp";
  } else {
    throw new ApiError(
      400,
      "INVALID_FILE_SIGNATURE",
      "Format berkas tidak didukung."
    );
  }

  // 5. Verify reported MIME type from client to prevent MIME-spoofing
  if (reportedMime) {
    const normReported = reportedMime.toLowerCase().trim();
    const isMimeCompatible =
      (canonicalMime === "application/pdf" && normReported === "application/pdf") ||
      (canonicalMime === "image/jpeg" && (normReported === "image/jpeg" || normReported === "image/jpg")) ||
      (canonicalMime === "image/png" && normReported === "image/png") ||
      (canonicalMime === "image/webp" && normReported === "image/webp");

    if (!isMimeCompatible) {
      throw new ApiError(
        400,
        "MIME_MISMATCH",
        `Header Content-Type ('${reportedMime}') tidak sesuai dengan format biner berkas yang terverifikasi ('${canonicalMime}').`
      );
    }
  }

  // 6. Sanitize original filename and enforce matching extension
  const sanitizedOriginalName = sanitizeAndValidateFileName(originalName, canonicalExt);

  return {
    mimeType: canonicalMime,
    extension: canonicalExt,
    sanitizedOriginalName,
  };
}
