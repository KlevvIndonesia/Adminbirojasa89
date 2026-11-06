export interface ProfitItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  rekening: string;
  invoice: string;
  tanggalTTB: string;
  ttb: string;
  jemputDokumen?: string;
  prosesSamsat?: string;
  pengantaranKembali?: string;
  metodePembayaran?: string;
  bank?: string;
  namaRekening?: string;
  noRekening?: string;
  tanggalBayar?: string;
  tanggalUangMasuk?: string;
  status?: string;
  totalTagihan?: number;
  eligiblePayment?: number;
  overpayment?: number;
  grossProfit?: number;
  pendapatanJasa?: number;
  labaKotor?: number;
  matchedCOGS?: number;
  isExplicitZero?: boolean;
  costClassification?: string;
  isFinancialAnomaly?: boolean;
  anomalyReason?: string;
  holdStatus?: string;
}

export interface KasMessengerItem {
  id: number;
  tanggal: string;
  jenis: string;
  messenger: string;
  keterangan: string;
  in: number;
  out: number;
  total: number;
  orderNo?: string;
}

export interface KasKantorItem {
  id: number;
  tanggal: string;
  status: string;
  keterangan: string;
  debit: number;
  kredit: number;
  total: number;
  tipe?: string;
  saldo?: number;
  masuk?: number;
  keluar?: number;
  metode?: string;
  bank?: string;
  invoiceRef?: string;
  penanggungJawab?: string;
  kategori?: string;
  orderNo?: string;
  invoiceNo?: string;
}

export interface PengeluaranItem {
  id: number;
  tanggal: string;
  keterangan: string;
  nominal: number;
  penanggungJawab?: string;
  kategori?: string;
  orderNo?: string;
  invoiceNo?: string;
}

export interface BelumKurangBayarItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  status: string;
  invoice: string;
  kekurangan: number;
}

export interface ProfitTerpendingItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  status: string;
  invoice: string;
  alasan: string;
}

export interface CashbackTerpendingItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  profit: number;
  status: string;
  invoice: string;
  jumlahCashback: number;
  cashbackPersen: string | number;
}

export interface TagihanItem {
  id: number;
  tanggal: string;
  customer: string;
  nopol: string;
  jenisLayanan: string;
  totalTagihan: number;
  terbayar: number;
  sisa: number;
  status: string;
  jatuhTempo: string;
}

export interface LabaRugiMonthlyItem {
  bulan: string;
  pendapatan: number;
  pengeluaran: number;
  laba: number;
}

export interface PenjualanItem {
  id: number;
  tglMasuk: string;
  r4r2: string;
  nopol: string;
  customer: string;
  namaPemilik?: string;
  namaSesuaiBPKB: string;
  jenisPengurusan: string;
  skemaPembayaran?: string;
  jenisBayar: string;
  tglUangMasuk: string;
  uangMasuk: number;
  bank: string;
  biayaSamsat?: number;
  uangKeluar: number;
  tglUangKeluar: string;
  uangKeluarDari: string;
  profit: number;
  statusPembayaran?: string;
  status: string;
  noInvoice: string;
  tglInvoice: string;
  tandaTerima: string;
  bpkb?: string;
  statusBPKB?: string;
  ttbBPKB?: string;
}

export const profitData: ProfitItem[] = [];

export const kasMessengerData: KasMessengerItem[] = [];

export const kasKantorData: KasKantorItem[] = [];

export const pengeluaranKantorData: PengeluaranItem[] = [];

export const belumKurangBayarData: BelumKurangBayarItem[] = [];

export const profitTerpendingData: ProfitTerpendingItem[] = [];

export const cashbackTerpendingData: CashbackTerpendingItem[] = [];

export const tagihanData: TagihanItem[] = [];

export const labaRugiData: LabaRugiMonthlyItem[] = [];

export const mutasiLDData: PenjualanItem[] = [];

export const mutasiASData: PenjualanItem[] = [];

export const bbnData: PenjualanItem[] = [];

export const perpanjanganPajakData: PenjualanItem[] = [];

export const lainnyaData: PenjualanItem[] = [];
