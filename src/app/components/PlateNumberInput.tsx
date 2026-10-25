import React, { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";

export interface PlateParts {
  prefix: string;
  number: string;
  suffix: string;
}

/**
 * Safely parse any raw plate number string (e.g. "B 1234 ABC", "b1234abc", "B-1234-ABC", "D 89", "RI 1")
 * into prefix, number, and suffix without losing or truncating non-standard plates.
 */
export function parsePlateNumber(raw: string | null | undefined): PlateParts {
  if (!raw || raw.trim() === "" || raw.trim() === "-") {
    return { prefix: "B", number: "", suffix: "" };
  }

  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9\s-]/g, "");

  // 1. If string is space-separated or dash-separated: "B 1234 ABC" or "B-1234-ABC"
  const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    const prefix = tokens[0].slice(0, 2);
    // Find first token with digits for the number part
    const numIdx = tokens.findIndex((t, idx) => idx > 0 && /\d/.test(t));
    if (numIdx !== -1) {
      const number = tokens[numIdx].replace(/\D/g, "").slice(0, 6);
      const suffix = tokens.slice(numIdx + 1).join("").replace(/[^A-Z]/g, "").slice(0, 3);
      return { prefix, number, suffix };
    }
  }

  // 2. Continuous string pattern: e.g. "B1234ABC", "D5678EFG", "AB12CD"
  const continuousMatch = cleaned.replace(/[\s-]/g, "").match(/^([A-Z]{1,2})(\d{1,6})([A-Z]{0,3})$/);
  if (continuousMatch) {
    return {
      prefix: continuousMatch[1],
      number: continuousMatch[2],
      suffix: continuousMatch[3] || "",
    };
  }

  // 3. Fallback for non-standard / incomplete inputs: extract leading letters, middle digits, trailing letters
  const matchGeneric = cleaned.match(/^([A-Z]{1,3})?\s*(\d{1,6})?\s*([A-Z]{1,4})?$/);
  if (matchGeneric) {
    return {
      prefix: (matchGeneric[1] || "B").slice(0, 2),
      number: (matchGeneric[2] || "").slice(0, 6),
      suffix: (matchGeneric[3] || "").slice(0, 3),
    };
  }

  // 4. Ultimate safe fallback: preserve first word as prefix if letters, otherwise use "B"
  return {
    prefix: tokens[0]?.slice(0, 2) || "B",
    number: (tokens[1] || "").replace(/\D/g, "").slice(0, 6),
    suffix: tokens.slice(2).join("").slice(0, 3),
  };
}

/**
 * Format 3 parts into canonical single plate string with single space separation.
 */
export function formatPlateNumber(prefix: string, number: string, suffix: string): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const cleanNumber = number.trim().replace(/\D/g, "").slice(0, 6);
  const cleanSuffix = suffix.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

  const parts = [cleanPrefix, cleanNumber, cleanSuffix].filter(Boolean);
  return parts.join(" ");
}

/**
 * Normalize plate number for search / comparison by removing all spaces and punctuation.
 */
export function normalizePlateNumberForSearch(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export interface PlateNumberInputProps {
  value?: string;
  onChange: (fullPlate: string, parts: PlateParts) => void;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  className?: string;
  id?: string;
}

/**
 * Canonical 3-Box Plate Number Input component.
 * Box 1: Plat Depan (1-2 uppercase letters)
 * Box 2: Nomor Plat (1-4 digits)
 * Box 3: Plat Belakang (0-3 uppercase letters)
 */
export function PlateNumberInput({
  value = "",
  onChange,
  disabled = false,
  required = false,
  hasError = false,
  className = "",
  id,
}: PlateNumberInputProps) {
  const initial = parsePlateNumber(value);
  const [prefix, setPrefix] = useState(initial.prefix);
  const [number, setNumber] = useState(initial.number);
  const [suffix, setSuffix] = useState(initial.suffix);

  // Sync state if external value changes (e.g. form reset or prefill)
  useEffect(() => {
    const parsed = parsePlateNumber(value);
    setPrefix(parsed.prefix);
    setNumber(parsed.number);
    setSuffix(parsed.suffix);
  }, [value]);

  const updateParts = (newPrefix: string, newNumber: string, newSuffix: string) => {
    setPrefix(newPrefix);
    setNumber(newNumber);
    setSuffix(newSuffix);
    const full = formatPlateNumber(newPrefix, newNumber, newSuffix);
    onChange(full, { prefix: newPrefix, number: newNumber, suffix: newSuffix });
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    updateParts(val, number, suffix);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    updateParts(prefix, val, suffix);
  };

  const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    updateParts(prefix, number, val);
  };

  const combinedDisplay = formatPlateNumber(prefix, number, suffix);

  return (
    <div className={cn("space-y-1", className)} id={id}>
      <div className="flex items-center gap-1.5 max-w-sm">
        {/* 1. Plat Depan (Huruf) */}
        <div className="w-16 shrink-0">
          <Input
            placeholder="B"
            maxLength={2}
            value={prefix}
            onChange={handlePrefixChange}
            disabled={disabled}
            aria-label="Plat Depan (Huruf)"
            title="Plat Depan (Kode Wilayah, misal: B, D, F)"
            className="h-8.5 text-xs font-mono font-bold text-center uppercase tracking-wider bg-background border-border"
          />
        </div>

        {/* 2. Nomor Plat (Angka) */}
        <div className="flex-1 min-w-[70px]">
          <Input
            placeholder="1234"
            maxLength={6}
            value={number}
            onChange={handleNumberChange}
            disabled={disabled}
            required={required}
            aria-label="Nomor Plat (Angka)"
            title="Nomor Plat Kendaraan (1 - 6 Digit)"
            className={cn(
              "h-8.5 text-xs font-mono font-bold text-center tracking-widest bg-background border-border",
              hasError && "border-destructive ring-1 ring-destructive/40"
            )}
          />
        </div>

        {/* 3. Plat Belakang (Huruf Seri) */}
        <div className="w-20 shrink-0">
          <Input
            placeholder="ABC"
            maxLength={3}
            value={suffix}
            onChange={handleSuffixChange}
            disabled={disabled}
            aria-label="Plat Belakang (Huruf)"
            title="Plat Belakang (Huruf Seri, misal: SAM, ABC)"
            className="h-8.5 text-xs font-mono font-bold text-center uppercase tracking-wider bg-background border-border"
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Hasil: <strong className="font-mono text-foreground">{combinedDisplay || "B 1234 ABC"}</strong>
      </p>
    </div>
  );
}
