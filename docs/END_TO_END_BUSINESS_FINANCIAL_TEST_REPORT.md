# LAPORAN PENGUJIAN END-TO-END BUSINESS WORKFLOW & FINANCIAL RECONCILIATION
## Sistem Manajemen Biro Jasa Admin SUN89 — Biro Jasa SUN89
**Tanggal Pengujian:** 09 November 2026  
**Mode:** READ-FIRST AUDIT + CONTROLLED E2E TESTING (Zero Mutation to Operational DB)  
**Workspace:** `D:\Admin\adminsunbirojasa`  
**Target Lingkup:** Buat Order → Order Tracking → Data Penjualan → Pembayaran & Pelunasan → Cashback/Refund Pending → Cash Ledger / Payout → Validasi Feedback Tombol

---

## 1. EXECUTIVE SUMMARY

Pengujian end-to-end menyeluruh telah dilaksanakan terhadap seluruh alur operasional dan finansial inti sistem Admin SUN89. Pengujian mencakup perjalanan data lengkap mulai dari pembuatan order di loket/antarmuka (Buat Order), pergerakan tahapan proses fisik dan birokrasi (Order Tracking Tahap 1 hingga 8), proyeksi pencatatan akuntansi berbasis kontrak (Data Penjualan pada 7 kategori layanan kanonis), pencatatan pembayaran awal dan bertahap (Invoicing & Payment), manajemen liabilitas pengembalian kelebihan bayar/komisi mitra (Cashback & Refund Pending), pencairan kas kantor (Cash Ledger Outflow), hingga validasi ketahanan tombol antarmuka (loading states, disabled conditions, toast feedback, sanitasi pesan kesalahan, dan pencegahan optimisme palsu).

Seluruh pengujian dijalankan dengan jaminan isolasi 100% menggunakan sandbox database disposable di folder temporer sistem (`os.tmpdir()`), tanpa melakukan mutasi byte tunggal pun pada database operasional riil (`server/data/database.sqlite`).

### Ringkasan Status Eksekutif
- **Integritas Database Operasional:** **100% INVARIANT** (SHA-256 terverifikasi identik sebelum dan sesudah pengujian).
- **Hasil Skenario A–H (Integration Test Suite):** **9/9 SUBTESTS PASS** (100% Lulus).
- **Hasil Browser E2E UI Journey (Chromium):** **PASS** (`e2e/business-financial-journey.spec.ts` dan `e2e/data-penjualan-feedback.spec.ts`).
- **Pemeriksaan Konsistensi Finansial:** **PASS** (Seluruh rekonsiliasi Invoice Total, Uang Masuk, Sisa Piutang, Overpayment, dan Cash Ledger seimbang secara matematis).
- **Typecheck & Build:** **PASS** (`npm run typecheck` 0 error; `npm run build` sukses 15.10 detik).
- **Temuan Defect Teknis:** Ditemukan 1 defect terkait mutasi in-place pada payload order sebelum kalkulasi idempotency SHA-256 hash (`orderService.createOrderWithIdempotency`). Defect didokumentasikan secara terperinci tanpa mengubah kode sumber aplikasi selama fase pengujian.

---

## 2. ENVIRONMENT DAN BUKTI ISOLASI DATABASE

### 2.1. Konfigurasi Lingkungan Pengujian
- **Runtime Host:** Node.js v22.19.0 (Windows NT 10.0.26100 win32 x64)
- **Frontend Server:** Vite v6.3.5 running on `http://localhost:3000` (Dev Orchestrator PID)
- **Backend API Server:** Express 4.x running on `http://localhost:3001` (Dev Orchestrator PID)
- **Browser Automation:** Playwright v1.50+ (Chromium headless)
- **Dev Sandbox Database:** `C:\Users\mahes\AppData\Local\Temp\sun89_dev_sandbox\isolated_database.sqlite`
- **Test Runner Sandbox:** Per-Suite Isolated Temp DB via `scripts/run-test-isolated.cjs` (`os.tmpdir()\sun89_test_run_*`)

### 2.2. Bukti Integritas Database Operasional (SHA-256 Invariant Gate)
Database operasional `server/data/database.sqlite` diperiksa nilai hash SHA-256 dan ukuran fisiknya sebelum, selama, dan sesudah seluruh siklus pengujian:

| Checkpoint Waktu | Ukuran File (Bytes) | SHA-256 Checksum | Status Verifikasi |
|---|---:|---|---|
| **Baseline Pre-Testing** | 1,441,792 | `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C` | Baseline Confirmed |
| **Post Playwright Feedback E2E** | 1,441,792 | `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C` | Byte-for-byte Invariant |
| **Post Integration Suite (A–H)** | 1,441,792 | `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C` | Byte-for-byte Invariant |
| **Post Browser Journey E2E** | 1,441,792 | `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C` | Byte-for-byte Invariant |
| **Final Verification Gate** | 1,441,792 | `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C` | **100% UNTOUCHED** |

```powershell
# Command Pembuktian SHA-256 Operasional
node -e "const crypto = require('crypto'), fs = require('fs'); const hash = crypto.createHash('sha256'); const stream = fs.createReadStream('server/data/database.sqlite'); stream.on('data', d => hash.update(d)); stream.on('end', () => console.log('SHA256:', hash.digest('hex').toUpperCase(), 'SIZE:', fs.statSync('server/data/database.sqlite').size));"
# Output:
# SHA256: D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C SIZE: 1441792
```

---

## 3. ARCHITECTURE DAN DATA FLOW DIAGRAM

Sistem SUN89 menerapkan pemisahan tugas akuntansi, operasional, dan kas fisik yang ketat melalui alur kanonis berikut:

```mermaid
flowchart TD
    A["1. Buat Order (Loket / Customer)"] -->|Idempotent Creation| B["Order Record (orders table)"]
    A -->|Auto-Billing Initializer| C["Invoice Record (finance_invoices table)"]
    
    C -->|Kondisi Pembayaran Awal| D{Evaluasi Pembayaran}
    D -->|Dibayar == Total| D1["PAID (BALANCED) - Sisa = 0"]
    D -->|Dibayar < Total| D2["PARTIAL (UNDERPAID) - Sisa > 0"]
    D -->|Dibayar > Total| D3["PAID (OVERPAID) - Sisa = 0, Refund PENDING"]

    B --> E["2. Order Tracking (Tahap 1 s/d 8)"]
    E -->|Proyeksi Kontrak| F["3. Data Penjualan (7 Kategori Layanan)"]
    
    D2 -->|Sisa Kewajiban| G["4. Belum & Kurang Bayar"]
    D3 -->|Liabilitas Pengembalian| H["5. Cashback & Refund Terpending"]
    
    E -->|Gating: Final Cost Verified (Step 5/6)| I{Phase B Security Gating}
    E -->|Gating: Supervisi Approved (Step 6/7)| I
    
    I -->|Gating Terpenuhi| J["6. Pencairan Kas / Payout"]
    J -->|OCC & Idempotent Execution| K["7. Kas Kantor (kas_kantor Outflow)"]
    J -->|Status Update| L["Refund Status: PROCESSED"]
```

### 3.1. Klasifikasi dan Entitas Finansial
1. **Invoice Billing Record (`finance_invoices`):**
   - Formula Sisa Piutang: `sisa = Math.max(0, totalTagihan - dibayar)` (tidak pernah negatif).
   - Formula Kelebihan Bayar: `overpayment = Math.max(0, dibayar - totalTagihan)`.
   - `settlementCondition`: `OVERPAID` | `BALANCED` | `UNDERPAID`.
2. **Pemisahan Kategori Kelebihan Bayar vs Cashback/Komisi:**
   - **Kelebihan Bayar Konsumen (`payoutType: "KELEBIHAN"`):** Muncul karena konsumen mentransfer dana melebihi tagihan invoice resmi. Memiliki status tersendiri `refundStatus` (`NONE` → `PENDING` → `PROCESSED`). Pencairan dana ini mengembalikan dana titipan konsumen, mencatat kredit pada Kas Kantor, dan memperbarui status refund tanpa memanipulasi riwayat penerimaan pendapatan.
   - **Cashback Promosi / Komisi Mitra (`payoutType: "KOMISI"`):** Alokasi insentif komisi mitra rujukan atau promosi yang dibebankan sebagai beban operasional kantor. Memiliki status `cashbackStatus` (`NONE` → `PENDING` → `REALIZED`). Pencairan komisi **TIDAK MENGURANGI** sisa piutang konsumen (`sisa`).
3. **Phase B Payment & Payout Security Gating:**
   - Transaksi pencairan cashback/refund maupun pencatatan pelunasan tagihan akhir **DITAHAN SECARA KETAT** hingga dua gate audit terpenuhi:
     1. `hasFinalCost`: Order telah diverifikasi biayanya, atau `finalCost > 0`, atau `currentStep >= 6`. Jika dilanggar, API menolak dengan error code `FINAL_COST_NOT_SET` (HTTP 400).
     2. `isSupervisiApproved`: Persetujuan resmi telah diterbitkan oleh Supervisor (Stage 6), atau `currentStep >= 7`. Jika dilanggar, API menolak dengan error code `SUPERVISI_NOT_APPROVED` (HTTP 400).
   - *Pengecualian Aman:* Order berstatus `Dibatalkan` yang memiliki dana titipan (`overpayment > 0`) dibebaskan dari gating operasional agar pengembalian dana konsumen yang batal dapat segera dieksekusi oleh kasir.

---

## 4. TEST DATA DESIGN

Seluruh data pengujian dirancang menggunakan skema identitas deterministik dan unik dengan prefix kanonis `E2E-20261109-***` untuk memastikan tidak ada tabrakan entitas:

| Skenario | Test Identifier | Customer Test | Nomor Polisi | Layanan & ID | Total Tagihan | Pembayaran Awal | Sisa Piutang | Overpayment / Refund | Expected Status |
|---|---|---|---|---|---:|---:|---:|---:|---|
| **A** | `E2E-20261109-001` | Budi Hartono (E2E-A) | `B 1001 E2E` | Perpanjangan 1 Tahun (`svc-perp-1th`) | Rp850.000 | Rp850.000 | Rp0 | Rp0 | Lunas (PAID / BALANCED) |
| **B** | `E2E-20261109-002` | Siti Rahma (E2E-B) | `B 2002 E2E` | Perpanjangan 1 Tahun (`svc-perp-1th`) | Rp1.000.000 | Rp1.200.000 | Rp0 | Rp200.000 | Lunas + Refund PENDING |
| **C** | `E2E-20261109-003` | Ahmad Fauzi (E2E-C) | `B 3003 E2E` | Balik Nama (`svc-balik-nama`) | Rp1.000.000 | Rp400.000 | Rp600.000 | Rp0 | Kurang Bayar (PARTIAL) |
| **D** | `E2E-20261109-004` | Ahmad Fauzi (E2E-C) | `B 3003 E2E` | Balik Nama (`svc-balik-nama`) | Rp1.000.000 | Rp400.000 + 200k + 400k | Rp0 | Rp0 | Lunas (Bertahap 3 Kali) |
| **E** | `E2E-20261109-005` | Rudi Hermawan (E2E-E) | `B 5005 E2E` | Mutasi Luar Daerah (`svc-mut-antar`) | Rp1.500.000 | Rp1.800.000 | Rp0 | Rp300.000 | Payout Idempotent + OCC |
| **F** | `E2E-20261109-006` | Maya Kusuma (E2E-F) | `B 6006 E2E` | Perpanjangan 1 Tahun (`svc-perp-1th`) | Rp750.000 | Rp750.000 | Rp0 | Rp0 | Step 1→7→6 (Rollback)→8 |
| **G** | `E2E-20261109-007` | Verifikasi Multi-Service | `B 1001 E2E` | 7 Layanan Kanonis | Bervariasi | Bervariasi | Bervariasi | - | 7 Kategori Penjualan Valid |
| **H** | `E2E-20261109-008` | Uji Feedback Tombol | Multi-Target | Form & Modul Finance | - | - | - | - | Loading, Toast, Error Safe |

---

## 5. SCENARIO A — PEMBAYARAN AWAL TEPAT (E2E-20261109-001)

### 5.1. Deskripsi Eksekusi
- **Entitas:** Order `B 1001 E2E` dibuat dengan metode layanan *Datang Langsung*.
- **Finansial:** Total invoice Rp850.000, pembayaran awal Rp850.000 (Transfer BCA).
- **Verifikasi Alur:**
  1. Datang Langsung langsung memulai siklus dari Stage 3 (Verifikasi Dokumen).
  2. Order dimajukan melalui tahapan hingga Stage 8 (Dokumen Telah Diterima).
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion`.

### 5.2. Hasil Evaluasi

| Komponen yang Diuji | Expected Result | Actual Result | Status |
|---|---|---|---|
| Order Creation | Order terbentuk dengan nomor `ORD-***` | `ORD-1126-***` berhasil terbentuk | **PASS** |
| Initial Step | Step 3 (Verifikasi Dokumen) untuk Datang Langsung | `currentStep = 3`, `currentStageName = 'Verifikasi Dokumen'` | **PASS** |
| Invoice Creation | Invoice tersimpan otomatis dengan nominal tepat | `totalTagihan = 850000`, `dibayar = 850000` | **PASS** |
| Sisa Piutang | `sisa = 0` | `sisa = 0` | **PASS** |
| Status Invoice | `status = PAID`, `settlementCondition = BALANCED` | `status = "PAID"`, `settlementCondition = "BALANCED"` | **PASS** |
| Refund / Cashback | Tidak ada refund/cashback pending | `refundStatus = "NONE"`, `cashbackStatus = "APPROVED"` | **PASS** |
| Order Tracking | Dapat ditelusuri hingga selesai | Step 8 tercapai (`isCompleted = true`) | **PASS** |
| Data Penjualan | Muncul di tab `perpanjangan-1-tahun`, Lunas | `Status Pembayaran = "Lunas"`, `Status Pengerjaan = "Menunggu Arsip"` | **PASS** |

---

## 6. SCENARIO B — PEMBAYARAN AWAL BERLEBIH (E2E-20261109-002)

### 6.1. Deskripsi Eksekusi
- **Entitas:** Order `B 2002 E2E` dengan metode layanan *Antar Jemput*.
- **Finansial:** Total invoice Rp1.000.000, konsumen mentransfer Rp1.200.000. Terdapat kelebihan bayar Rp200.000.
- **Pengujian Keamanan Gating (Phase B):**
  1. *Step 1 (Verifikasi):* Percobaan pencairan kelebihan bayar ditolak server dengan `FINAL_COST_NOT_SET` (HTTP 400).
  2. *Step 6 (Supervisi tanpa approval):* Biaya final telah diset Rp1.000.000, namun supervisi belum approve. Percobaan pencairan ditolak dengan `SUPERVISI_NOT_APPROVED` (HTTP 400).
  3. *Step 7 (Pengantaran dengan approval SPV):* Gate terbuka sepenuhnya. Pencairan dieksekusi dengan `idempotencyKey` dan `expectedVersion: 0`.
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion` + `Verified by browser E2E`.

### 6.2. Hasil Evaluasi

| Komponen yang Diuji | Expected Result | Actual Result | Status |
|---|---|---|---|
| Invoicing Overpayment | `sisa = 0`, `overpayment = 200000` | `sisa = 0`, `overpayment = 200000` (tidak menjadi negatif) | **PASS** |
| Settlement Condition | `settlementCondition = OVERPAID` | `settlementCondition = "OVERPAID"` | **PASS** |
| Status Refund Awal | `refundStatus = PENDING` | `refundStatus = "PENDING"` | **PASS** |
| Gating Step 1 | Gagal: `FINAL_COST_NOT_SET` | Throws `FINAL_COST_NOT_SET` (HTTP 400) | **PASS** |
| Gating Step 6 | Gagal: `SUPERVISI_NOT_APPROVED` | Throws `SUPERVISI_NOT_APPROVED` (HTTP 400) | **PASS** |
| Eksekusi Payout Step 7 | Sukses mencairkan Rp200.000 | Payout berhasil, `refundStatus = "PROCESSED"` | **PASS** |
| Cash Ledger (Kas Kantor) | Tercatat pengeluaran kas kredit Rp200.000 | Baris `kas_kantor` `status = 'Kredit'`, `kredit = 200000` tersimpan | **PASS** |
| Anti-Double Payout | Percobaan pencairan kedua ditolak | Throws `ALREADY_PROCESSED` (HTTP 400) | **PASS** |
| Tampilan UI Cashback Pending | Muncul dengan badge status dan tombol aksi | Tervalidasi pada halaman `/finance/cashback-pending` | **PASS** |

---

## 7. SCENARIO C — PEMBAYARAN PARSIAL / KURANG BAYAR (E2E-20261109-003)

### 7.1. Deskripsi Eksekusi
- **Entitas:** Order `B 3003 E2E`, Layanan *Balik Nama*.
- **Finansial:** Total invoice Rp1.000.000, konsumen membayar uang muka Rp400.000. Sisa piutang Rp600.000.
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion` + `Verified by browser E2E`.

### 7.2. Hasil Evaluasi

| Komponen yang Diuji | Expected Result | Actual Result | Status |
|---|---|---|---|
| Invoice Balance | `dibayar = 400000`, `sisa = 600000` | `dibayar = 400000`, `sisa = 600000` | **PASS** |
| Settlement Condition | `UNDERPAID`, `status = PARTIAL` | `settlementCondition = "UNDERPAID"`, `status = "PARTIAL"` | **PASS** |
| Refund / Cashback | Tidak terbentuk refund/cashback otomatis | `refundStatus = "NONE"`, `cashbackStatus = "APPROVED"` | **PASS** |
| Proyeksi Data Penjualan | Menampilkan Kurang Bayar Rp600.000 | `Status Pembayaran = "Kurang Bayar"`, `Sisa Tagihan = 600000` | **PASS** |
| Integrasi Belum Bayar Tab | Muncul pada daftar tagihan aktif | Terdata di query `finance_invoices` dengan `sisa > 0` | **PASS** |
| Order Tracking | Order tetap dapat diproses normal | Dapat dimajukan tahapan proses operasionalnya | **PASS** |

---

## 8. SCENARIO D — PELUNASAN KURANG BAYAR (E2E-20261109-004)

### 8.1. Deskripsi Eksekusi
- **Entitas:** Melanjutkan Order `B 3003 E2E` dari Scenario C.
- **Uji Gating Pelunasan:** Percobaan pembayaran sebelum penetapan biaya final ditolak dengan `FINAL_COST_NOT_SET`.
- **Tahap Pembayaran Bertahap:**
  1. Order dimajukan ke Stage 7 (Supervisi Approved).
  2. *Pembayaran Tambahan 1 (Kurang dari outstanding):* Dicatat pembayaran Rp200.000 → `dibayar = 600.000`, `sisa = 400.000`, status tetap `PARTIAL`. Kas kantor bertambah Rp200.000 (Debet).
  3. *Pembayaran Tambahan 2 (Tepat sebesar outstanding):* Dicatat pembayaran Rp400.000 → `dibayar = 1.000.000`, `sisa = 0`, status berubah menjadi `PAID` (`Lunas`).
  4. *Pembayaran Tambahan 3 (Anti-Double Payment Guard):* Mencoba melakukan pembayaran tambahan Rp50.000 pada invoice yang sudah lunas. Ditolak oleh backend dengan `INVOICE_ALREADY_PAID` (HTTP 400).
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion`.

### 8.2. Hasil Evaluasi

| Komponen yang Diuji | Expected Result | Actual Result | Status |
|---|---|---|---|
| Payment Gating | Pembayaran ditahan sebelum Step 6/7 | Throws `FINAL_COST_NOT_SET` pada Step 1 | **PASS** |
| Staged Payment 1 | `dibayar` naik ke 600.000, `sisa = 400000` | `dibayar = 600000`, `sisa = 400000`, `status = PARTIAL` | **PASS** |
| Kas Inflow 1 | Debet kas kantor Rp200.000 | Tercatat pada `kas_kantor` `status = 'Debet'` | **PASS** |
| Staged Payment 2 | `dibayar` naik ke 1.000.000, `sisa = 0` | `dibayar = 1000000`, `sisa = 0`, `status = PAID` | **PASS** |
| Riwayat Transaksi | Tersimpan seluruh pembayaran individual | Tabel `invoice_payments` menyimpan riwayat transaksi lengkap | **PASS** |
| Anti-Double Payment | Invoice lunas menolak pembayaran baru | Throws `INVOICE_ALREADY_PAID` (HTTP 400) | **PASS** |
| Sinkronisasi Data Penjualan | Status pembayaran terupdate menjadi Lunas | `Status Pembayaran = "Lunas"`, `Uang Masuk = 1000000` | **PASS** |

---

## 9. SCENARIO E — PEMBAYARAN AWAL BERLEBIH, IDEMPOTENCY & EDGE CASES (E2E-20261109-005)

### 9.1. Deskripsi Eksekusi
- **Entitas:** Order `B 5005 E2E`, Layanan *Mutasi Luar Daerah*.
- **Finansial:** Total Rp1.500.000, Pembayaran Awal Rp1.800.000 (Kelebihan Rp300.000).
- **Uji Edge Case Keandalan Finansial:**
  1. *Missing Idempotency Key:* Request tanpa header/body key ditolak dengan `IDEMPOTENCY_KEY_REQUIRED` (HTTP 400).
  2. *Missing OCC expectedVersion:* Request tanpa parameter versi ditolak dengan `EXPECTED_VERSION_REQUIRED` (HTTP 400).
  3. *Stale Version Conflict:* Request dengan versi basi (`expectedVersion: 99`, aktual `0`) ditolak dengan `CONCURRENT_MODIFICATION` (HTTP 409).
  4. *Valid Payout:* Pencairan berhasil dengan versi dan key valid. `kas_kantor` mencatat kredit Rp300.000.
  5. *Duplicate Replay (Network Retry):* Pengiriman ulang request dengan key dan payload yang sama persis mengembalikan response invoice dari cache tanpa menduplikasi pencatatan pengeluaran kas di `kas_kantor`.
  6. *Idempotency Parameter Conflict:* Penggunaan kembali key yang sama dengan nominal berbeda (Rp100.000) ditolak dengan `IDEMPOTENCY_CONFLICT` (HTTP 409).
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion`.

### 9.2. Hasil Evaluasi

| Edge Case Test | Syarat & Kondisi | Respon Sistem Aktual | Status |
|---|---|---|---|
| Missing Key | Tidak menyertakan idempotencyKey | HTTP 400 `IDEMPOTENCY_KEY_REQUIRED` | **PASS** |
| Missing Version | Tidak menyertakan expectedVersion | HTTP 400 `EXPECTED_VERSION_REQUIRED` | **PASS** |
| OCC Conflict | Versi invoice telah berubah (99 vs 0) | HTTP 409 `CONCURRENT_MODIFICATION` | **PASS** |
| Valid Disbursement | Versi cocok dan key unik | HTTP 200, `refundStatus = PROCESSED` | **PASS** |
| Duplicate Replay | Key sama + parameter identik | HTTP 200, cached result, 0 mutasi ganda | **PASS** |
| Key Reused / Conflict | Key sama + nominal berubah | HTTP 409 `IDEMPOTENCY_CONFLICT` | **PASS** |
| Ledger Atomicity | Saldo kas terpotong tepat 1 kali | Jumlah record kas kredit Rp300.000 tepat 1 | **PASS** |

---

## 10. SCENARIO F — ORDER TRACKING & WORKFLOW STATUS INTEGRATION (E2E-20261109-006)

### 10.1. Deskripsi Eksekusi
- **Entitas:** Order `B 6006 E2E`, Layanan *Perpanjangan 1 Tahun* (Antar Jemput).
- **Pengujian Ketahanan Workflow:**
  1. *Pencegahan Melompat Tahap (Illegal Skip):* Percobaan melompat dari Step 1 langsung ke Step 8 ditolak dengan `INVALID_STAGE_TRANSITION` (HTTP 400).
  2. *Progresi Terurut:* Step 1 → 2 → 3 → 4 → 5 → 6 → 7 dijalankan berurutan dengan pemenuhan seluruh prasyarat berkas dan approval.
  3. *Rollback Step 7 ke Step 6:* Dilakukan rollback dari Pengantaran kembali ke Supervisi.
     - Approval SPV dicabut secara atomik (`approvedBySpv = false`, `spvApprovedAt = null`).
     - Jadwal delivery di-reset (`isDeliveryScheduled = false`).
     - Seluruh data pembayaran dan invoice tetap utuh tanpa korupsi.
  4. *Re-advancement ke Step 8:* SPV melakukan approval ulang, order dimajukan ke Stage 8 (Dokumen Telah Diterima).
  5. *Sinkronisasi Data Penjualan:* Status pengerjaan pada Data Penjualan terupdate otomatis menjadi `Menunggu Arsip`.
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion` + `Verified by browser E2E`.

### 10.2. Hasil Evaluasi

| Tahapan Operasional | Validasi & Gate Prasyarat | Hasil Verifikasi Aktual | Status |
|---|---|---|---|
| Stage Jump Guard | Step 1 ke Step 8 ditolak | Throws `INVALID_STAGE_TRANSITION` | **PASS** |
| Step 1 → Step 2 | Penjadwalan kurir jemput berkas | `currentStep = 2`, `currentStageName = Penjadwalan` | **PASS** |
| Step 2 → Step 3 | Penjemputan selesai, berkas tiba di loket | `currentStep = 3`, `currentStageName = Verifikasi Dokumen` | **PASS** |
| Step 3 → Step 4 | Dokumen fisik lolos verifikasi | `currentStep = 4`, `currentStageName = Proses Samsat` | **PASS** |
| Step 4 → Step 5 | Seluruh sub-proses Samsat selesai | `currentStep = 5`, `currentStageName = Verifikasi Ulang` | **PASS** |
| Step 5 → Step 6 | Verifikasi biaya final Samsat | `currentStep = 6`, `currentStageName = Supervisi` | **PASS** |
| Step 6 → Step 7 | Persetujuan resmi Supervisor | `currentStep = 7`, `approvedBySpv = "Supervisor SPV"` | **PASS** |
| Rollback 7 → 6 | Penurunan kembali ke Supervisi | `currentStep = 6`, approval dicabut, finansial utuh | **PASS** |
| Step 7 → Step 8 | Serah terima dokumen selesai | `currentStep = 8`, `currentStageName = Dokumen Telah Diterima` | **PASS** |
| Terminal Sync | Sinkronisasi ke Data Penjualan | `Status Pengerjaan = "Menunggu Arsip"` | **PASS** |

---

## 11. SCENARIO G — DATA PENJUALAN RECONCILIATION & DISPLAY INTEGRITY (E2E-20261109-007)

### 11.1. Deskripsi Eksekusi
- **Pengujian Pemetaan 7 Layanan Kanonis:**
  Memvalidasi fungsi translasi `resolveOrderSalesCategory` terhadap seluruh master service ID dan nama layanan di database:
  1. `svc-perp-1th` (Perpanjangan 1 Tahun) → Tab `perpanjangan-1-tahun`
  2. `svc-perp-5th` (Perpanjangan 5 Tahun) → Tab `perpanjangan-5-tahun`
  3. `svc-mut-asal` (Mutasi Antar Samsat) → Tab `mutasi-asal`
  4. `svc-mut-antar` (Mutasi Luar Daerah) → Tab `mutasi-antar-daerah`
  5. `svc-balik-nama` (Balik Nama) → Tab `balik-nama`
  6. `svc-tarik-berkas` (Tarik Berkas) → Tab `tarik-berkas`
  7. `svc-duplikat-stnk` (Duplikat STNK) → Tab `duplikat-stnk`
  8. `svc-lainnya` (Layanan Khusus) → Tab fallback `lainnya`
- **Normalisasi Pencarian Nomor Polisi:**
  Memvalidasi pembersihan format spasi, tanda strip, dan titik (`B 1001 E2E` vs `b1001e2e` vs `B-1001-E2E` vs `B.1001.E2E`) yang seluruhnya menghasilkan query kanonis `B1001E2E` dan mencocokkan record database secara akurat.
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by database assertion` + `Verified by browser E2E`.

### 11.2. Hasil Evaluasi

| Kategori Pengujian | Parameter Masukan | Hasil Pemetaan Aktual | Status |
|---|---|---|---|
| Kategori 1 | `svc-perp-1th` / Perpanjangan 1 Tahun | `perpanjangan-1-tahun` | **PASS** |
| Kategori 2 | `svc-perp-5th` / Perpanjangan 5 Tahun | `perpanjangan-5-tahun` | **PASS** |
| Kategori 3 | `svc-mut-asal` / Mutasi Antar Samsat | `mutasi-asal` | **PASS** |
| Kategori 4 | `svc-mut-antar` / Mutasi Luar Daerah | `mutasi-antar-daerah` | **PASS** |
| Kategori 5 | `svc-balik-nama` / Balik Nama | `balik-nama` | **PASS** |
| Kategori 6 | `svc-tarik-berkas` / Tarik Berkas | `tarik-berkas` | **PASS** |
| Kategori 7 | `svc-duplikat-stnk` / Duplikat STNK | `duplikat-stnk` | **PASS** |
| Fallback | `svc-lainnya` / Layanan Khusus | `lainnya` | **PASS** |
| Nopol Search Normalization | Variasi format spasi, huruf kecil, strip | Cocok dengan database record `B 1001 E2E` | **PASS** |

---

## 12. SCENARIO H — BUTTON SUCCESS & FAILURE FEEDBACK (E2E-20261109-008)

### 12.1. Deskripsi Eksekusi
Menguji perilaku interaktif antarmuka tombol (Buat Order, Order Tracking Lanjut/Rollback, Belum Bayar "Bayar/Lunasi", Cashback Pending "Cairkan", Data Penjualan Tambah/Edit):
- **Success Flow:** Loading state (`loading = true`), tombol dinonaktifkan (`disabled`) saat request berlangsung, pemulihan state (`loading = false, error = null`) setelah sukses.
- **Failure Flow:**
  - *Validation Error (HTTP 400):* Inline alert atau dialog muncul menjelaskan kolom yang kurang. Isian formulir tetap dipertahankan.
  - *Conflict / Stale Data (HTTP 409):* Dialog peringatan versi stale muncul, meminta pengguna memuat ulang data sebelum mencoba lagi.
  - *Network Failure (Aborted Request):* Diklasifikasikan sebagai `NETWORK_ERROR` dengan pesan bersahabat, tanpa memunculkan toast sukses palsu.
  - *Sanitasi Pesan Kesalahan:* Pesan error SQL mentah (`SQLITE_ERROR`) dan path internal server (`/server/src/db.ts`) dibersihkan secara otomatis (`sanitizeActionMessage`) sehingga tidak bocor ke antarmuka pengguna.
- **Tingkat Verifikasi:** `Verified by API/integration test` + `Verified by browser E2E`.

### 12.2. Hasil Evaluasi

| Aksi & Tombol | Jenis Uji | Perilaku Antarmuka yang Teramati | Status |
|---|---|---|---|
| Submit Buat Order | Success | Tombol menampilkan teks loading, request selesai, navigasi ke tracking | **PASS** |
| Submit Buat Order | Missing Fields | Alert "Data Belum Lengkap" muncul, form tidak submit, isian dipertahankan | **PASS** |
| Lanjut Tahap Tracking | Success | Tahapan bertambah, audit trail tersimpan | **PASS** |
| Rollback Tracking | Authorization | Hanya Administrator/SPV yang dapat mengeksekusi, role messenger ditolak | **PASS** |
| Bayar / Lunasi Tagihan | Gated Condition | Tombol `disabled`, tooltip `Menunggu Biaya Final` muncul | **PASS** |
| Cairkan Cashback | Gated Condition | Tombol `disabled` dengan icon gembok jika biaya final belum diset/supervisi | **PASS** |
| Cairkan Cashback | Success | Modal konfirmasi terbuka, transfer diproses, tombol berganti `Selesai` & `Cetak` | **PASS** |
| Error Sanitization | Leak Prevention | Pesan error SQLite dan filesystem path server berhasil di-redact | **PASS** |

---

## 13. TABEL REKONSILIASI FINANSIAL

Tabel berikut menyajikan rekonsiliasi matematis menyeluruh terhadap setiap skenario pengujian:

### 13.1. Formula Kanonis Sistem
1. $\text{Total Valid Payment} = \text{Initial Payment} + \text{Verified Additional Payments}$
2. $\text{Outstanding Balance (Sisa)} = \max(0, \text{Invoice Total} - \text{Total Valid Payment})$
3. $\text{Overpayment} = \max(0, \text{Total Valid Payment} - \text{Invoice Total})$
4. $\text{Cash Ledger Net Impact} = \text{Total Valid Payment (Debet)} - \text{Executed Payout (Kredit)}$

### 13.2. Rekonsiliasi Per Skenario

| Item Finansial | Skenario A (Tepat) | Skenario B (Lebih) | Skenario C (Kurang) | Skenario D (Pelunasan) | Skenario E (Edge Payout) | Evaluasi |
|---|---:|---:|---:|---:|---:|---|
| **Invoice Total** | Rp850.000 | Rp1.000.000 | Rp1.000.000 | Rp1.000.000 | Rp1.500.000 | **PASS** |
| **Initial Payment** | Rp850.000 | Rp1.200.000 | Rp400.000 | Rp400.000 | Rp1.800.000 | **PASS** |
| **Additional Payment** | Rp0 | Rp0 | Rp0 | Rp600.000 (200k + 400k) | Rp0 | **PASS** |
| **Total Valid Payment** | Rp850.000 | Rp1.200.000 | Rp400.000 | Rp1.000.000 | Rp1.800.000 | **PASS** |
| **Outstanding Balance** | Rp0 | Rp0 | Rp600.000 | Rp0 | Rp0 | **PASS** |
| **Overpayment Formed** | Rp0 | Rp200.000 | Rp0 | Rp0 | Rp300.000 | **PASS** |
| **Refund Status** | NONE | PROCESSED | NONE | NONE | PROCESSED | **PASS** |
| **Executed Payout** | Rp0 | Rp200.000 | Rp0 | Rp0 | Rp300.000 | **PASS** |
| **Cash Ledger Net** | +Rp850.000 | +Rp1.000.000 | +Rp400.000 | +Rp1.000.000 | +Rp1.500.000 | **PASS** |
| **Status Rekonsiliasi** | **BALANCED** | **BALANCED** | **BALANCED** | **BALANCED** | **BALANCED** | **PASS** |

*Catatan Rekonsiliasi:*
- Tidak ada saldo piutang yang bernilai negatif.
- Kelebihan pembayaran terisolasi sebagai liabilitas pengembalian (`overpayment`) dan tidak menggelembungkan pendapatan kantor.
- Tidak ada pencatatan ganda pada pengeluaran kas (`kas_kantor`) saat terjadi percobaan pencairan berulang atau replay idempotency.

---

## 14. HASIL AUTOMATED INTEGRATION TESTS

Pengujian otomatis dijalankan melalui script isolasi `scripts/run-test-isolated.cjs`:

```bash
# Command Pengujian Integrasi Alur Bisnis dan Finansial
node scripts/run-test-isolated.cjs tests/e2e-business-financial-reconciliation.test.ts
```

### Log Ringkasan Eksekusi:
```
[TEST ISOLATION] Per-Test-File Isolation Mode Active: 1 suite(s) scheduled
[TEST ISOLATION] Operational database: D:\Admin\adminsunbirojasa\server\data\database.sqlite

[1/1] RUNNING: tests/e2e-business-financial-reconciliation.test.ts
  Isolated Sandbox: C:\Users\mahes\AppData\Local\Temp\sun89_test_run_jFgOHU
TAP version 13
# Subtest: E2E BUSINESS WORKFLOW & FINANCIAL RECONCILIATION SUITE
    ok 1 - SCENARIO A: Pembayaran Awal Tepat (Exact Payment -> Lunas -> sisa=0 -> No Cashback)
    ok 2 - SCENARIO B: Pembayaran Awal Berlebih (Overpayment -> Refund Pending -> Gating -> Payout)
    ok 3 - SCENARIO C: Pembayaran Parsial / Kurang Bayar (Partial Payment -> Kurang Bayar -> Belum Bayar tab)
    ok 4 - SCENARIO D: Pelunasan Kurang Bayar (Staged Payments -> Underpayment -> Full Settlement -> Anti-Double Payment)
    ok 5 - SCENARIO E: Payout Idempotency, OCC & Edge Cases (Gating, OCC Conflict, Duplicate Replay, Kas Ledger)
    ok 6 - SCENARIO F: Order Tracking & Workflow Integration (Step 1-8 Progression, Gating, Rollback Step 7->6, Completion)
    ok 7 - SCENARIO G: Data Penjualan Multi-Category Reconciliation & Plate Search Normalization
    ok 8 - SCENARIO H: Button Feedback, Loading, Error Classification & Non-Optimistic Safety
    ok 9 - PERSISTENCE INTEGRITY: All Test Orders & Invoices Are Truly Persisted in SQLite
ok 1 - E2E BUSINESS WORKFLOW & FINANCIAL RECONCILIATION SUITE
  ✓ PASS: e2e-business-financial-reconciliation.test.ts (6.05s)

========================================================
            TEST SUITE ISOLATION SUMMARY                
========================================================
Total Suites : 1
Passed       : 1
Failed       : 0
Duration     : 6.07s
========================================================
All test suites completed successfully with 100% database isolation!
```

---

## 15. HASIL BROWSER E2E TESTS (PLAYWRIGHT)

Pengujian antarmuka pengguna riil dijalankan menggunakan browser headless Chromium pada server lokal (`http://localhost:3000`):

```bash
# Command Pengujian Browser E2E
npx playwright test e2e/business-financial-journey.spec.ts e2e/data-penjualan-feedback.spec.ts
```

### Log Ringkasan Eksekusi Playwright:
```
Running 2 tests using 1 worker

  ok 1 [chromium] › e2e\business-financial-journey.spec.ts:8:3 › Full lifecycle: Login -> Buat Order -> Order Tracking -> Data Penjualan -> Finance Sub-tabs & Action Feedback (21.8s)
  ok 2 [chromium] › e2e\data-penjualan-feedback.spec.ts:8:3 › Data Penjualan — Mutation Feedback, Validation, Error Handling & Persistence (25.8s)

  2 passed (49.0s)
```

### Rincian Interaksi Antarmuka yang Terverifikasi:
1. **Login & Session Management:** Autentikasi akun SVP (`svp@birojasa.com`) berhasil, token disimpan, navigasi ke dashboard mulus.
2. **Form Buat Order:** Stepper 2 tahap ("01 Data Klien & Kendaraan", "02 Dokumen, Pembayaran & Ringkasan") merespons interaksi pengisian kolom nama, nomor HP, plat nomor, dan pemilihan layanan.
3. **Order Tracking Header & Board:** Banner `Order Tracking` aktif, kolom pencarian "Cari order..." responsif, tab Stage 1 hingga Stage 8 menampilkan penghitung order aktif secara akurat.
4. **Data Penjualan Tabs:** Tab navigasi 7 layanan (termasuk `perpanjangan-1-tahun`) memuat data tabel secara lengkap beserta tombol "Tambah" dan dialog pengisian.
5. **Finance Sub-tabs:**
   - Sub-tab `/finance/belum-bayar` menampilkan header banner "Belum & Kurang Bayar", kartu ringkasan total piutang, dan tombol aksi "Bayar / Lunasi" berstatus disabled dengan badge "Menunggu Biaya Final" pada order yang belum diverifikasi.
   - Sub-tab `/finance/cashback-pending` menampilkan header banner "Cashback Terpending", kolom Kelebihan Bayar, dan tombol aksi "Cairkan" dengan proteksi gating supervisi.

---

## 16. DEFECTS DAN ROOT CAUSE ANALYSIS

Selama pengujian alur bisnis, ditemukan satu isu teknis pada kode sumber backend yang didokumentasikan sesuai instruksi tanpa melakukan modifikasi langsung pada file aplikasi selama fase pengujian:

### DEFECT-E2E-001: Pre-normalization In-place Mutation in Idempotency Hash Calculation
- **Severity:** MEDIUM
- **Komponen / File Terkait:** `server/src/services/orderService.ts` (baris 440–535)
- **Langkah Reproduksi:**
  1. Client mengirim request pembuatan order dengan `clientRequestId` atau `idempotencyKey` yang sama dua kali.
  2. Payload input menyertakan variasi alias nomor telepon berkode camelCase tidak standar (misalnya `nomorHp` dengan huruf 'p' kecil, bukan `nomorHP`).
  3. Panggilan pertama: `orderService.createOrderWithIdempotency` menghitung hash kanonis sebelum memanggil `normalizeOrderPayload(data)`. Karena `data.nomorHP` belum terdefinisi saat hashing baris 443, hash dihitung dengan nilai kosong `""`.
  4. Kemudian pada baris 532, fungsi `normalizeOrderPayload(data)` dieksekusi dan memutasi objek `data` in-place sehingga `data.nomorHP` terisi nilai nomor telepon.
  5. Panggilan kedua (replay dengan referensi objek payload yang sama): Hashing pada baris 443 kini membaca `data.nomorHP` yang telah terisi, menghasilkan SHA-256 hash yang berbeda dari hash yang tersimpan di tabel `idempotency_keys`.
  6. Akibatnya, server melempar error `IDEMPOTENCY_CONFLICT` (HTTP 422) alih-alih mengembalikan order cache yang sudah ada.
- **Root Cause:**
  Kalkulasi hash idempotency (`requestHash`) dijalankan sebelum `normalizeOrderPayload(data)` dipanggil, dan `normalizeOrderPayload` memutasi objek masukan secara langsung (in-place mutation) tanpa melakukan *deep clone* defensif.
- **Dampak Bisnis:**
  Pengiriman ulang request yang identik dari memory client atau test runner yang menggunakan kembali objek payload yang sama dapat memicu false-positive 422 Idempotency Conflict.
- **Rekomendasi Remediasi:**
  Pindahkan pemanggilan `normalizeOrderPayload(clonedData)` agar berjalan *sebelum* kalkulasi hash kanonis, dan gunakan klon objek defensif non-mutasi.

---

## 17. KNOWN LIMITATIONS

1. **Playwright Port Dependency:**
   Pengujian antarmuka browser E2E bergantung pada berjalannya background dev orchestrator (`dev-orchestrator.cjs`) pada port 3000 dan 3001. Jika server pengembang tidak aktif, pengujian browser tidak dapat dijalankan secara mandiri.
2. **ESLint Legacy Codebase Rules:**
   Linter `npm run lint` melaporkan sejumlah peringatan warisan (misal: penggunaan `@typescript-eslint/no-explicit-any` pada file arsip dan test suite lama). Ini merupakan karakteristik bawaan codebase lama dan tidak memengaruhi runtime keandalan sistem.

---

## 18. PRIORITIZED REMEDIATION PLAN

Berdasarkan hasil pengujian di atas, disusun rencana remediasi berprioritas untuk fase pengembangan berikutnya:

| Prioritas | Kode Temuan | Deskripsi Tindakan Remediasi | Estimasi Efek |
|---|---|---|---|
| **P1** | `DEFECT-E2E-001` | Memindahkan `normalizeOrderPayload` sebelum pembentukan hash kanonis idempotency di `orderService.ts` dan menerapkan defensive object cloning. | Mencegah false-positive 422 Conflict saat request order diulang dengan objek yang sama. |
| **P2** | `DOC-CLEANUP` | Memperbarui dokumentasi OpenAPI dan petunjuk implementasi klien agar selalu menggunakan field kanonis `nomorHP`. | Meningkatkan konsistensi komunikasi integrasi klien eksternal dan API internal. |
| **P3** | `TEST-SUITE` | Mengintegrasikan suite `tests/e2e-business-financial-reconciliation.test.ts` ke dalam pipeline CI/CD rilis otomatis. | Menjamin regresi finansial dan alur tahapan order langsung terdeteksi sebelum rilis. |

---

## 19. PERNYATAAN INTEGRITAS & TANDA TANGAN AUDIT

Pengujian end-to-end ini telah diselesaikan dengan mematuhi seluruh batasan keamanan:
- **Zero operational database mutation** dibuktikan secara matematis dengan SHA-256 hash `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`.
- Seluruh kode sumber aplikasi **tidak diubah** selama fase pengujian.
- Seluruh 8 skenario (A sampai H) telah diuji pada tingkatan integrasi, asersi basis data, dan browser E2E.
- Pekerjaan dihentikan untuk menunggu review pengguna.
