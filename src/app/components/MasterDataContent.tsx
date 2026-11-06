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
import { EnhancedTable } from "./EnhancedTable";
import { ProvinsiFilterSelect } from "./ProvinsiFilterSelect";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { pricingStore, usePricingStore } from "../data/pricingStore";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";

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

  const [selectedProvinsi, setSelectedProvinsi] = useState("all");

  const rawSamsatData = useMemo(() => {
    return pricingStore
      .getSamsats()
      .map((s) => ({
        id: s.id,
        nama: s.name,
        alamat: s.alamat,
        wilayah: s.wilayah,
        provinsi: s.nama_provinsi || "Belum Terpetakan",
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
  }, []);

  const samsatData = useMemo(() => {
    if (selectedProvinsi === "all") return rawSamsatData;
    if (selectedProvinsi === "unmapped") {
      return rawSamsatData.filter(
        (s) => s.provinsi === "Belum Terpetakan" || s.provinsi === "-" || !s.provinsi
      );
    }
    return rawSamsatData.filter(
      (s) => s.provinsi.toLowerCase() === selectedProvinsi.toLowerCase()
    );
  }, [rawSamsatData, selectedProvinsi]);

  const [isAddSamsatOpen, setIsAddSamsatOpen] = useState(false);
  const [isEditSamsatOpen, setIsEditSamsatOpen] = useState(false);
  const [isDeleteSamsatOpen, setIsDeleteSamsatOpen] = useState(false);
  const [selectedSamsat, setSelectedSamsat] = useState<any>(null);
  const [samsatForm, setSamsatForm] = useState({ nama: "", alamat: "", wilayah: "", provinsi: "" });

  const [isAddKaryawanOpen, setIsAddKaryawanOpen] = useState(false);
  const [isEditKaryawanOpen, setIsEditKaryawanOpen] = useState(false);
  const [isDeleteKaryawanOpen, setIsDeleteKaryawanOpen] = useState(false);
  const [selectedKaryawan, setSelectedKaryawan] = useState<any>(null);

  const [karyawanForm, setKaryawanForm] = useState({
    nama: "", jabatan: "ADMIN" as any, email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif" as any,
    jenisKelamin: "Laki-laki" as any, alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01"
  });

  // Samsat handlers
  const handleAddSamsat = async () => {
    if (!samsatForm.nama || !samsatForm.wilayah) {
      toast.error("Nama Samsat dan Wilayah wajib diisi!");
      return;
    }
    try {
      await pricingStore.addSamsat({
        name: samsatForm.nama,
        alamat: samsatForm.alamat || `Kantor Samsat ${samsatForm.wilayah}`,
        wilayah: samsatForm.wilayah,
        nama_provinsi: samsatForm.provinsi || undefined,
      });
      setSamsatForm({ nama: "", alamat: "", wilayah: "", provinsi: "" });
      setIsAddSamsatOpen(false);
      toast.success("Data Samsat berhasil ditambahkan!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menambahkan data Samsat ke server");
    }
  };

  const handleEditSamsat = async () => {
    if (!samsatForm.nama || !samsatForm.wilayah) {
      toast.error("Nama Samsat dan Wilayah wajib diisi!");
      return;
    }
    try {
      await pricingStore.updateSamsat(selectedSamsat.id, {
        name: samsatForm.nama,
        alamat: samsatForm.alamat,
        wilayah: samsatForm.wilayah,
        nama_provinsi: samsatForm.provinsi || undefined,
      });
      setIsEditSamsatOpen(false);
      toast.success("Data Samsat berhasil diupdate!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengupdate data Samsat di server");
    }
  };

  const handleDeleteSamsat = async () => {
    if (!selectedSamsat) return;
    try {
      await pricingStore.deleteSamsat(selectedSamsat.id);
      setIsDeleteSamsatOpen(false);
      toast.success("Data Samsat berhasil dihapus!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus data Samsat di server");
    }
  };

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
    });
    setKaryawanForm({
      nama: "", jabatan: "ADMIN", email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif",
      jenisKelamin: "Laki-laki", alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01"
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
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Data Samsat", "Kelola daftar Samsat dan wilayah pelayanan")}
        <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
          <EnhancedTable
            columns={[
              { key: "nama", label: "Nama Samsat" },
              { key: "alamat", label: "Alamat" },
              { key: "wilayah", label: "Wilayah" },
              { key: "provinsi", label: "Provinsi" },
            ]}
            data={samsatData}
            filterSlot={
              <ProvinsiFilterSelect
                value={selectedProvinsi}
                onValueChange={setSelectedProvinsi}
              />
            }
            onAdd={() => {
              setSamsatForm({ nama: "", alamat: "", wilayah: "", provinsi: "" });
              setIsAddSamsatOpen(true);
            }}
            onEdit={(item) => {
              setSelectedSamsat(item);
              setSamsatForm({
                nama: item.nama,
                alamat: item.alamat,
                wilayah: item.wilayah,
                provinsi: item.provinsi === "-" ? "" : item.provinsi,
              });
              setIsEditSamsatOpen(true);
            }}
            onDelete={(item) => {
              setSelectedSamsat(item);
              setIsDeleteSamsatOpen(true);
            }}
            onExport={(format) => toast.success(`Export ${format.toUpperCase()}`)}
            searchPlaceholder="Cari samsat..."
          />
        </Card>

        {/* Dialog Add Samsat */}
        <Dialog open={isAddSamsatOpen} onOpenChange={setIsAddSamsatOpen}>
          <DialogContent className="border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Data Samsat</DialogTitle>
              <DialogDescription>Tambahkan kantor atau wilayah pelayanan Samsat baru</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label>Nama Samsat <span className="text-destructive font-semibold">*</span></Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Contoh: Samsat Kota Bandung"
                  value={samsatForm.nama}
                  onChange={(e) => setSamsatForm({ ...samsatForm, nama: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Wilayah (Kabupaten/Kota) <span className="text-destructive font-semibold">*</span></Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Contoh: Kota Bandung"
                  value={samsatForm.wilayah}
                  onChange={(e) => setSamsatForm({ ...samsatForm, wilayah: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Provinsi</Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Contoh: Jawa Barat"
                  value={samsatForm.provinsi}
                  onChange={(e) => setSamsatForm({ ...samsatForm, provinsi: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alamat</Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Alamat kantor Samsat"
                  value={samsatForm.alamat}
                  onChange={(e) => setSamsatForm({ ...samsatForm, alamat: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setIsAddSamsatOpen(false)}>Batal</Button>
              <Button size="sm" onClick={handleAddSamsat}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Edit Samsat */}
        <Dialog open={isEditSamsatOpen} onOpenChange={setIsEditSamsatOpen}>
          <DialogContent className="border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Data Samsat</DialogTitle>
              <DialogDescription>Perbarui informasi kantor Samsat</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label>Nama Samsat <span className="text-destructive font-semibold">*</span></Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Nama Samsat"
                  value={samsatForm.nama}
                  onChange={(e) => setSamsatForm({ ...samsatForm, nama: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Wilayah (Kabupaten/Kota) <span className="text-destructive font-semibold">*</span></Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Wilayah"
                  value={samsatForm.wilayah}
                  onChange={(e) => setSamsatForm({ ...samsatForm, wilayah: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Provinsi</Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Provinsi"
                  value={samsatForm.provinsi}
                  onChange={(e) => setSamsatForm({ ...samsatForm, provinsi: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alamat</Label>
                <Input
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Alamat"
                  value={samsatForm.alamat}
                  onChange={(e) => setSamsatForm({ ...samsatForm, alamat: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setIsEditSamsatOpen(false)}>Batal</Button>
              <Button size="sm" onClick={handleEditSamsat}>Simpan Perubahan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog Delete Samsat */}
        <AlertDialog open={isDeleteSamsatOpen} onOpenChange={setIsDeleteSamsatOpen}>
          <AlertDialogContent className="border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Samsat</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus "{selectedSamsat?.nama}"? Tindakan ini akan menghapus data Samsat dan konfigurasi terkait.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSamsat} className="bg-red-500 hover:bg-red-600">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
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
                { key: "id", label: "NIK / ID" },
                { key: "nama", label: "Nama" },
                { key: "jabatan", label: "Jabatan" },
                { key: "email", label: "Email" },
                { key: "wilayah", label: "Wilayah" },
                { key: "noHp", label: "No. HP" },
                { key: "tanggalLahir", label: "Tgl Lahir" },
                { key: "status", label: "Status" },
              ]}
              data={karyawanData}
              onAdd={() => {
                setKaryawanForm({
                  nama: "", jabatan: "ADMIN", email: "", wilayah: "Jakarta Timur", noHp: "", status: "Aktif",
                  jenisKelamin: "Laki-laki", alamat: "", gajiPokok: "", tanggalBergabung: "", tanggalLahir: "2000-01-01"
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
                  tanggalLahir: item.tanggalLahir || "2000-01-01"
                });
                setIsEditKaryawanOpen(true);
              }}
              onDelete={(item) => {
                setSelectedKaryawan(item);
                setIsDeleteKaryawanOpen(true);
              }}
              onExport={(format) => toast.success(`Export ${format.toUpperCase()}`)}
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

        {/* Delete Karyawan */}
        <AlertDialog open={isDeleteKaryawanOpen} onOpenChange={setIsDeleteKaryawanOpen}>
          <AlertDialogContent className="border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Karyawan</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus data karyawan "{selectedKaryawan?.nama}"? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteKaryawan} className="bg-red-500 hover:bg-red-600">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

      <div className="space-y-1.5">
        <Label>Alamat</Label>
        <Input
          className="bg-input-background border-border h-9 text-xs"
          placeholder="Alamat lengkap"
          value={form.alamat}
          onChange={(e) => set("alamat")(e.target.value)}
        />
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
