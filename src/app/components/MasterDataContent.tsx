import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { BiayaLayanan } from "./BiayaLayanan";
import { ManajemenPengguna } from "./ManajemenPengguna";
import { HargaDasarSamsat } from "./HargaDasarSamsat";
import { MetodePembayaranMaster } from "./MetodePembayaranMaster";
import { MasterLayanan } from "./MasterLayanan";
import { WilayahSamsatManager } from "./WilayahSamsatManager";
import { EnhancedTable } from "./EnhancedTable";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { pricingStore, usePricingStore } from "../data/pricingStore";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { PermanentErasureDialog } from "./PermanentErasureDialog";
import { exportToCSV, exportToPrintablePDF } from "../utils/exportUtils";

const wilayahOptions = [
  "Jakarta Timur", "Jakarta Barat", "Jakarta Selatan",
  "Jakarta Utara", "Jakarta Pusat", "Depok", "Bekasi", "Tangerang", "Bogor", "Tangerang Selatan",
];

interface MasterDataContentProps {
  tab: string;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function MasterDataContent({ tab }: MasterDataContentProps) {
  usePricingStore();
  const {
    karyawan: karyawanData,
    isLoading: isKaryawanLoading,
    error: karyawanError,
    isStale: isKaryawanStale,
    refresh: refreshKaryawan,
    addKaryawan,
    updateKaryawan,
    deleteKaryawan
  } = useKaryawanPengguna();

  const [isAddKaryawanOpen, setIsAddKaryawanOpen] = useState(false);
  const [isEditKaryawanOpen, setIsEditKaryawanOpen] = useState(false);
  const [isDeleteKaryawanOpen, setIsDeleteKaryawanOpen] = useState(false);
  const [selectedKaryawan, setSelectedKaryawan] = useState<any>(null);

  const [karyawanForm, setKaryawanForm] = useState({
    nama: "", jabatan: "ADMIN" as any, email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif" as any,
    jenisKelamin: "Laki-laki" as any, alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01",
    nikKtp: ""
  });

  // Karyawan handlers
  const handleAddKaryawan = () => {
    if (!karyawanForm.nama || !karyawanForm.jabatan || !karyawanForm.email) {
      toast.error("Harap lengkapi field wajib!");
      return;
    }
    addKaryawan({
      nama: karyawanForm.nama,
      jabatan: karyawanForm.jabatan,
      email: karyawanForm.email,
      wilayah: karyawanForm.wilayah,
      noHp: karyawanForm.noHp,
      status: karyawanForm.status,
      jenisKelamin: karyawanForm.jenisKelamin,
      alamat: karyawanForm.alamat,
      gajiPokok: parseInt(karyawanForm.gajiPokok) || 0,
      tanggalBergabung: karyawanForm.tanggalBergabung || new Date().toISOString().split("T")[0],
      tanggalLahir: karyawanForm.tanggalLahir || "2000-01-01",
      nikKtp: karyawanForm.nikKtp || undefined,
    });
    setKaryawanForm({
      nama: "", jabatan: "ADMIN", email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif",
      jenisKelamin: "Laki-laki", alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01",
      nikKtp: ""
    });
    setIsAddKaryawanOpen(false);
    toast.success("Data karyawan berhasil ditambahkan!");
  };

  const handleEditKaryawan = () => {
    if (!karyawanForm.nama || !karyawanForm.jabatan || !karyawanForm.email) {
      toast.error("Harap lengkapi field wajib!");
      return;
    }
    updateKaryawan(selectedKaryawan.id, {
      ...karyawanForm,
      gajiPokok: parseInt(karyawanForm.gajiPokok) || 0,
    });
    setIsEditKaryawanOpen(false);
    toast.success("Data karyawan berhasil diupdate!");
  };

  const handleDeleteKaryawan = () => {
    if (selectedKaryawan) {
      deleteKaryawan(selectedKaryawan.id);
    }
    setIsDeleteKaryawanOpen(false);
    toast.success("Data karyawan berhasil dihapus!");
  };

  // Sub-tab Breadcrumb renderer (Shell header in App.tsx already provides authoritative breadcrumb & title)
  const renderSubTabHeader = (_title: string, _description?: string) => null;

  // ─── Samsat Tab ───────────────────────────────────────────────────────────
  if (tab === "samsat") {
    return <WilayahSamsatManager />;
  }

  // ─── Karyawan Tab ─────────────────────────────────────────────────────────
  if (tab === "karyawan") {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Karyawan", "Kelola data karyawan dan informasi terkait")}

        {isKaryawanLoading && karyawanData.length === 0 ? (
          <Card className="p-8 border border-border/80 bg-card shadow-xs flex-1 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-foreground">Memuat data karyawan dari database...</p>
            <p className="text-xs text-muted-foreground mt-1">Menghubungkan ke API server...</p>
          </Card>
        ) : karyawanError && karyawanData.length === 0 ? (
          <Card className="p-8 border border-red-500/20 bg-red-500/5 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Gagal Memuat Data Karyawan</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {karyawanError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshKaryawan()}
              className="mt-4 gap-2 border-border text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </Button>
          </Card>
        ) : (
          <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
            {isKaryawanStale && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Peringatan Sinkronisasi:</strong> Gagal memperbarui data dari server ({karyawanError}). Menampilkan data cache lokal terakhir.
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshKaryawan()}
                  className="h-7 text-xs gap-1 hover:bg-amber-500/20"
                >
                  <RefreshCw className="w-3 h-3" />
                  Coba Sinkron Ulang
                </Button>
              </div>
            )}
            <EnhancedTable
              columns={[
                { key: "id", label: "NIK / ID", width: "110px", align: "center" },
                { key: "nama", label: "Nama", width: "160px" },
                { key: "jabatan", label: "Jabatan", width: "110px", align: "center" },
                { key: "email", label: "Email", width: "180px" },
                { key: "wilayah", label: "Wilayah", width: "130px" },
                { key: "noHp", label: "No. HP", width: "120px" },
                { key: "tanggalLahir", label: "Tgl Lahir", width: "100px", align: "center" },
                { key: "status", label: "Status", width: "100px", align: "center" },
              ]}
              data={karyawanData}
              showRowNumber={true}
              onAdd={() => {
                setKaryawanForm({
                  nama: "", jabatan: "ADMIN", email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif",
                  jenisKelamin: "Laki-laki", alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01",
                  nikKtp: ""
                });
                setIsAddKaryawanOpen(true);
              }}
              onEdit={(item) => {
                setSelectedKaryawan(item);
                setKaryawanForm({
                  nama: item.nama, jabatan: item.jabatan, email: item.email,
                  wilayah: item.wilayah, noHp: item.noHp, status: item.status,
                  jenisKelamin: item.jenisKelamin, alamat: item.alamat,
                  gajiPokok: item.gajiPokok?.toString() || "",
                  tanggalBergabung: item.tanggalBergabung,
                  tanggalLahir: item.tanggalLahir || "2000-01-01",
                  nikKtp: item.nikKtp || ""
                });
                setIsEditKaryawanOpen(true);
              }}
              onDelete={(item) => {
                setSelectedKaryawan(item);
                setIsDeleteKaryawanOpen(true);
              }}
              onExport={(format, dataToExport) => {
                if (dataToExport.length === 0) {
                  toast.error("Tidak ada data karyawan untuk diekspor");
                  return;
                }
                const today = new Date().toISOString().split("T")[0];
                if (format === "csv") {
                  exportToCSV({
                    filename: `data-karyawan-${today}.csv`,
                    columns: [
                      { header: "No", format: (_, idx) => idx + 1 },
                      { header: "NIK / ID", key: "id" },
                      { header: "Nama Lengkap", key: "nama" },
                      { header: "Jabatan", key: "jabatan" },
                      { header: "Email", key: "email" },
                      { header: "Wilayah", key: "wilayah" },
                      { header: "No. HP", key: "noHp" },
                      { header: "Tanggal Lahir", key: "tanggalLahir" },
                      { header: "Gaji Pokok", format: (r) => r.gajiPokok ? `Rp ${Number(r.gajiPokok).toLocaleString("id-ID")}` : "-" },
                      { header: "Tanggal Bergabung", key: "tanggalBergabung" },
                      { header: "Status", key: "status" },
                    ],
                    data: dataToExport,
                  });
                  toast.success(`Berhasil mengekspor ${dataToExport.length} data karyawan ke CSV!`);
                } else {
                  exportToPrintablePDF({
                    title: "LAPORAN DATA KARYAWAN",
                    subtitle: "Master data staf dan karyawan operasional SUN Biro Jasa",
                    metadata: [
                      { label: "Total Karyawan", value: `${dataToExport.length} Orang` },
                      { label: "Status Operasional", value: "Aktif & Terdaftar" },
                    ],
                    columns: [
                      { header: "No", width: "40px", align: "center", format: (_, idx) => idx + 1 },
                      { header: "NIK / ID", width: "95px", align: "center", key: "id" },
                      { header: "Nama", width: "140px", key: "nama" },
                      { header: "Jabatan", width: "95px", align: "center", format: (r) => `<span class="badge">${r.jabatan}</span>` },
                      { header: "Email", width: "150px", key: "email" },
                      { header: "Wilayah", width: "110px", key: "wilayah" },
                      { header: "No. HP", width: "105px", key: "noHp" },
                      { header: "Status", width: "80px", align: "center", format: (r) => `<span class="badge">${r.status}</span>` },
                    ],
                    data: dataToExport,
                  });
                  toast.success(`Membuka dokumen cetak ${dataToExport.length} data karyawan...`);
                }
              }}
              searchPlaceholder="Cari karyawan..."
            />
          </Card>
        )}

        {/* Add Karyawan */}
        <Dialog open={isAddKaryawanOpen} onOpenChange={setIsAddKaryawanOpen}>
          <DialogContent className="border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Karyawan</DialogTitle>
              <DialogDescription>Tambahkan data karyawan baru</DialogDescription>
            </DialogHeader>
            <KaryawanForm form={karyawanForm} onChange={setKaryawanForm} />
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddKaryawanOpen(false)}>Batal</Button>
              <Button onClick={handleAddKaryawan}>Tambah</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Karyawan */}
        <Dialog open={isEditKaryawanOpen} onOpenChange={setIsEditKaryawanOpen}>
          <DialogContent className="border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Karyawan</DialogTitle>
              <DialogDescription>Update data karyawan</DialogDescription>
            </DialogHeader>
            <KaryawanForm form={karyawanForm} onChange={setKaryawanForm} />
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsEditKaryawanOpen(false)}>Batal</Button>
              <Button onClick={handleEditKaryawan}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permanent Erasure Dialog for Karyawan */}
        <PermanentErasureDialog
          open={isDeleteKaryawanOpen}
          onOpenChange={setIsDeleteKaryawanOpen}
          targetId={selectedKaryawan?.id || null}
          targetName={selectedKaryawan?.nama}
          onErasureSuccess={() => {
            refreshKaryawan();
          }}
        />
      </div>
    );
  }

  if (tab === "layanan") return <MasterLayanan />;
  if (tab === "metode-pembayaran") return <MetodePembayaranMaster />;
  if (tab === "biaya-layanan") return <BiayaLayanan />;
  if (tab === "harga-dasar-samsat") return <HargaDasarSamsat />;
  if (tab === "pengguna") return <ManajemenPengguna />;

  return <div>Content not found</div>;
}

// ─── Karyawan form extracted to avoid duplication ─────────────────────────
type KaryawanFormData = {
  nama: string; jabatan: string; email: string; wilayah: string;
  noHp: string; status: string; jenisKelamin: string; alamat: string;
  gajiPokok: string; tanggalBergabung: string; tanggalLahir: string;
  nikKtp: string;
};

function KaryawanForm({ form, onChange }: {
  form: KaryawanFormData;
  onChange: (f: KaryawanFormData) => void;
}) {
  const set = (key: keyof KaryawanFormData) => (val: string) =>
    onChange({ ...form, [key]: val });

  const wilayahOpts = [
    "Jakarta Timur", "Jakarta Barat", "Jakarta Selatan",
    "Jakarta Utara", "Jakarta Pusat", "Depok", "Bekasi", "Tangerang", "Bogor", "Tangerang Selatan",
  ];

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nama Lengkap <span className="text-destructive font-semibold">*</span></Label>
          <Input
            className="bg-input-background border-border h-9 text-xs"
            placeholder="Nama karyawan"
            value={form.nama}
            onChange={(e) => set("nama")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Jenis Kelamin</Label>
          <Select value={form.jenisKelamin} onValueChange={set("jenisKelamin")}>
            <SelectTrigger className="bg-input-background border-border h-9 text-xs">
              <SelectValue placeholder="Pilih" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Laki-laki">Laki-laki</SelectItem>
              <SelectItem value="Perempuan">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Jabatan <span className="text-destructive font-semibold">*</span></Label>
          <Select value={form.jabatan} onValueChange={set("jabatan")}>
            <SelectTrigger className="bg-input-background border-border h-9 text-xs">
              <SelectValue placeholder="Pilih jabatan" />
            </SelectTrigger>
            <SelectContent>
              {["ADMIN", "SVP", "FINANCE", "CLILEN", "MESSENGER"].map(j => (
                <SelectItem key={j} value={j}>{j}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Wilayah</Label>
          <Select value={form.wilayah} onValueChange={set("wilayah")}>
            <SelectTrigger className="bg-input-background border-border h-9 text-xs">
              <SelectValue placeholder="Pilih wilayah" />
            </SelectTrigger>
            <SelectContent>
              {wilayahOpts.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email <span className="text-destructive font-semibold">*</span></Label>
          <Input
            className="bg-input-background border-border h-9 text-xs"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>No. HP</Label>
          <Input
            className="bg-input-background border-border h-9 text-xs font-mono tabular-nums"
            placeholder="081234567890"
            value={form.noHp}
            onChange={(e) => set("noHp")(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>NIK KTP</Label>
          <Input
            className="bg-input-background border-border h-9 text-xs font-mono tabular-nums"
            placeholder="16 digit NIK KTP (opsional)"
            maxLength={16}
            value={form.nikKtp || ""}
            onChange={(e) => set("nikKtp")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Alamat</Label>
          <Input
            className="bg-input-background border-border h-9 text-xs"
            placeholder="Alamat domisili"
            value={form.alamat}
            onChange={(e) => set("alamat")(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Gaji Pokok</Label>
          <Input
            className="bg-input-background border-border h-9 text-xs font-mono tabular-nums"
            type="number"
            placeholder="5000000"
            value={form.gajiPokok}
            onChange={(e) => set("gajiPokok")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tanggal Lahir <span className="text-destructive font-semibold">*</span></Label>
          <Input
            className="bg-input-background border-border h-9 text-xs"
            type="date"
            value={form.tanggalLahir}
            onChange={(e) => set("tanggalLahir")(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tanggal Bergabung</Label>
        <Input
          className="bg-input-background border-border h-9 text-xs"
          type="date"
          value={form.tanggalBergabung}
          onChange={(e) => set("tanggalBergabung")(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={set("status")}>
          <SelectTrigger className="bg-input-background border-border h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Aktif">Aktif</SelectItem>
            <SelectItem value="Nonaktif">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
