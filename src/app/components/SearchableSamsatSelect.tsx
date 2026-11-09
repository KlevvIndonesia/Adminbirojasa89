import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { pricingStore } from "../data/pricingStore";
import type { SamsatMasterItem } from "../../domain/pricing/types";
import { cn } from "./ui/utils";

export interface SearchableSamsatSelectProps {
  value: string;
  onValueChange: (value: string, item?: SamsatMasterItem) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  className?: string;
}

export function SearchableSamsatSelect({
  value,
  onValueChange,
  placeholder = "Pilih Samsat",
  disabled = false,
  error = false,
  id,
  className,
}: SearchableSamsatSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. All Samsats pre-sorted alphabetically A-Z by wilayah/name
  const allSamsats = useMemo(() => {
    return [...pricingStore.getSamsats()].sort((a, b) =>
      a.wilayah.localeCompare(b.wilayah, "id", { sensitivity: "base" })
    );
  }, []);

  // 2. Resolve selected item without being altered by user search typing
  const selectedItem = useMemo(() => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    return (
      allSamsats.find(
        (s) =>
          s.wilayah.toLowerCase() === normalized ||
          s.name.toLowerCase() === normalized ||
          s.id.toLowerCase() === normalized
      ) || null
    );
  }, [allSamsats, value]);

  // 3. Real-time search filter (case-insensitive, matches name, wilayah, and nama_provinsi)
  const filteredSamsats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSamsats;
    return allSamsats.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.wilayah.toLowerCase().includes(q) ||
        (s.nama_provinsi && s.nama_provinsi.toLowerCase().includes(q)) ||
        (s.kode_kabupaten_kota && s.kode_kabupaten_kota.includes(q))
    );
  }, [allSamsats, search]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const displayLabel = selectedItem ? selectedItem.wilayah : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          className={cn(
            "w-full flex items-center justify-between rounded-md border border-border bg-input-background px-3 h-9 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left transition-colors",
            error && "border-destructive ring-1 ring-destructive/40",
            !selectedItem && !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground ml-2 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] sm:w-[380px] p-2 bg-popover border border-border shadow-lg rounded-md z-50"
      >
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Ketik nama Samsat atau Provinsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background border-border"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto space-y-0.5 divide-y divide-border/20 text-xs">
          {filteredSamsats.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Samsat "{search}" tidak ditemukan
            </div>
          ) : (
            filteredSamsats.map((samsat) => {
              const isSelected =
                selectedItem?.id === samsat.id ||
                samsat.wilayah.toLowerCase() === (value || "").toLowerCase() ||
                samsat.name.toLowerCase() === (value || "").toLowerCase();

              return (
                <button
                  key={samsat.id}
                  type="button"
                  onClick={() => {
                    onValueChange(samsat.wilayah, samsat);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-sm flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                    isSelected && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate font-medium">{samsat.wilayah}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {samsat.name} {samsat.nama_provinsi ? `• ${samsat.nama_provinsi}` : ""}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
