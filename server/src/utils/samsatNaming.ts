/**
 * Canonical Samsat Office Naming Utilities
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Enforces standardized naming:
 * - Kota: "Samsat Kota <Nama>" (e.g., "Samsat Kota Bogor", "Samsat Kota Depok", "Samsat Kota Bekasi")
 * - Kabupaten: "Samsat Kabupaten <Nama>" (e.g., "Samsat Kabupaten Bogor")
 * - DKI Jakarta: "Samsat <Wilayah>" (e.g., "Samsat Jakarta Timur")
 * - Strips and prevents duplicate prefixes (e.g. "Samsat Kota Kota ...", "Samsat Samsat ...")
 */

export function normalizeSamsatOfficeName(
  inputName?: string | null,
  jenisWilayah?: "Kota" | "Kabupaten" | string | null,
  rawWilayahName?: string | null
): string {
  if (!inputName || typeof inputName !== "string" || !inputName.trim()) {
    if (jenisWilayah && rawWilayahName) {
      const cleanW = rawWilayahName.replace(/^(kabupaten|kota\s+administrasi|kota)\s+/i, "").trim();
      if (cleanW.toLowerCase().startsWith("jakarta ") || cleanW.toLowerCase() === "jakarta") {
        return `Samsat ${cleanW}`;
      }
      return jenisWilayah === "Kota" ? `Samsat Kota ${cleanW}` : `Samsat Kabupaten ${cleanW}`;
    }
    return "";
  }

  let cleaned = inputName.trim();

  // 1. Strip repeated leading "Samsat" (case-insensitive)
  while (/^samsat\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^samsat\s+/i, "").trim();
  }

  // 2. Determine effective jenisWilayah if not explicitly passed
  let effectiveJenis = jenisWilayah;
  if (!effectiveJenis) {
    if (/^kota\s+/i.test(cleaned) || (rawWilayahName && /^kota\s+/i.test(rawWilayahName))) {
      effectiveJenis = "Kota";
    } else if (/^kabupaten\s+/i.test(cleaned) || (rawWilayahName && /^kabupaten\s+/i.test(rawWilayahName))) {
      effectiveJenis = "Kabupaten";
    }
  }

  // 3. Strip repeated leading "Kota", "Kabupaten", or "Kota Administrasi"
  while (/^(kota\s+administrasi|kota|kabupaten)\s+/i.test(cleaned)) {
    const match = cleaned.match(/^(kota\s+administrasi|kota|kabupaten)\s+/i);
    if (!effectiveJenis && match) {
      effectiveJenis = match[1].toLowerCase().includes("kota") ? "Kota" : "Kabupaten";
    }
    cleaned = cleaned.replace(/^(kota\s+administrasi|kota|kabupaten)\s+/i, "").trim();
  }

  // 4. Also strip any residual repeated "Samsat" after removing prefixes (e.g. "Samsat Kota Samsat Bogor")
  while (/^samsat\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^samsat\s+/i, "").trim();
  }

  // 5. DKI Jakarta special handling: "Jakarta Pusat", "Jakarta Timur", etc. do not use "Kota" in standard Samsat names
  if (cleaned.toLowerCase().startsWith("jakarta ") || cleaned.toLowerCase() === "jakarta") {
    return `Samsat ${cleaned}`;
  }

  // 6. Format according to effective jenisWilayah
  if (effectiveJenis === "Kota") {
    return `Samsat Kota ${cleaned}`;
  } else if (effectiveJenis === "Kabupaten") {
    return `Samsat Kabupaten ${cleaned}`;
  }

  return `Samsat ${cleaned}`;
}
