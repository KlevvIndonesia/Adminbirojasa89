# PHASE 1B — VALIDATION ADDENDUM
## Frontend API Consumption Audit — Findings Verification & Classification Correction

> **Mode:** STRICT READ-ONLY FORENSIC CODE AUDIT  
> **Target:** Verification of Phase 1B Audit Findings & Metrics Disambiguation  
> **Author:** Senior Frontend Architect, API Integration Auditor & Software Contract Analyst  
> **Date:** 2026-11-09  
> **Integrity Status:** Database SHA-256 Unchanged (`D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`), Zero Mutations Applied  

---

## 1. Executive Summary

Dokumen ini merupakan **Validation Addendum** resmi terhadap laporan *Phase 1B — Frontend API Consumption Audit*. Tujuan addendum ini adalah melakukan verifikasi empiris mendalam terhadap temuan-temuan audit yang memerlukan pembuktian berbasis alur kode statis, merekonsiliasi ambiguitas parameter, melakukan granulasi terhadap analisis timestamp, membuktikan konsistensi gate workflow serah terima dokumen, serta mengklasifikasi ulang 32 kontrak backend yang belum dikonsumsi oleh dashboard admin frontend.

### Ringkasan Hasil Validasi Tambahan

1. **F-01 (`POST /api/pricing/samsat`): TERKONFIRMASI ABSEN DI BACKEND.**  
   Backend Express `pricingRoutes.ts` terbukti hanya menyediakan `GET /pricing/samsat`, `GET /pricing/samsat/:id`, dan `PUT /pricing/samsat/:id`. Fungsi `addSamsatItem()` pada `apiPricingProvider.ts:184-201` melakukan *optimistic unawaited fetch* tanpa memeriksa `res.ok`, sehingga HTTP 404 Not Found diabaikan secara diam-diam. Di sisi UI, tidak ada form aktif yang memanggil method ini karena UI mengelola 29 komponen kanonis nasional secara tetap via `PUT /api/pricing/samsat/:id` dan `PUT /api/pricing/samsat-tariffs`.

2. **F-02 (`GET /api/finance/invoices/:invoiceNo/payments`): PARAMETER MISMATCH DENGAN BACKEND QUERY.**  
   Frontend `FinanceContent.tsx:798, 1218` menggunakan fallback `item.invoice || item.invoiceNo || item.orderNo`. Backend `getInvoicePayments` secara ketat menjalankan SQL `SELECT * FROM invoice_payments WHERE invoice_no = ?`. Jika order belum menerbitkan invoice dan variabel jatuh ke `orderNo`, query mengembalikan array kosong (`[]`). Backend memiliki fungsi `dbFinanceRepository.getPaymentsByOrderNo(orderNo)`, namun fungsi ini belum diekspos melalui route HTTP.

3. **F-03 (Timestamp & Timezone API-06): KLASIFIKASI GRANULAR FIELD-BY-FIELD.**  
   Penyelidikan membuktikan bahwa pergeseran 7 jam mundur **tidak terjadi pada seluruh timestamp**:
   - **CONFIRMED INCORRECT (Mundur 7 Jam):** Kolom SQLite yang menggunakan default `datetime('now')` tanpa penanda `Z` (seperti `orders.updated_at`, `order_status_history.waktu_transisi`, `security_audit_logs.created_at`). Browser lokal (WIB / UTC+7) menafsirkannya sebagai waktu lokal.
   - **CORRECT (Akurat):** Timestamp ISO UTC dengan akhiran `Z` dari kode aplikasi (`audit_logs.created_at`, `orders.tanggal_masuk_berkas`), serta string tanggal kalender murni `YYYY-MM-DD` (`orders.created_at`, `invoice_payments.tanggal_bayar`).

4. **F-04 (Role vs Jabatan): MATCH VIA CONTROLLED ARCHITECTURAL MAPPING.**  
   Penyelidikan membuktikan bahwa backend `authService.ts:108` sendiri yang memetakan `jabatan: "SVP"` menjadi `role: "administrator"`. Normalisasi frontend `permissionStore.ts` dari `administrator` ke `svp` dilakukan strictly untuk evaluasi menu UI (`DEFAULT_PERMISSIONS.svp`). Mutasi permission role SVP/administrator dicegah secara identik baik di frontend (`saveRolePermissions`) maupun backend (`IMMUTABLE_ROLE`). Otorisasi API tetap ditegakkan oleh middleware backend via JWT.

5. **Workflow Delivery Gate Step 7 -> Step 8: MATCH VIA ADAPTER MAPPING.**  
   Penyelidikan end-to-end membuktikan bahwa meskipun form UI menangkap input dengan nama `proof.recipientName`, payload transisi `advanceOrderAsync` di `OrderTracking.tsx:2160` secara eksplisit memetakannya ke `receiverName: proof.recipientName`. Syarat backend (`receiverName`, `isReceived: true`, `deliveryStatus: "Dokumen Diserahkan"`, task status `COMPLETED`) terpenuhi secara penuh.

6. **Reklasifikasi 32 Kontrak Unused:**  
   32 kontrak yang sebelumnya dikelompokkan secara umum sebagai UNUSED kini direklasifikasi secara presisi: **8 Intentionally Unused** (health probes & public portal), **16 Not Required by Current Frontend Scope** (single resource getters & static bundled data), **8 Potential Missing Integration / Business Decision Required** (fitur koreksi order SPV, internal cash transfers, file deletion retry, void reimbursement), dan **0 Misclassified**.

---

## 2. Scope dan Read-Only Confirmation

Pekerjaan validasi ini dilaksanakan dengan mematuhi batasan **STRICT READ-ONLY**:
- **Source Code:** Tidak ada baris kode frontend (`src/`) maupun backend (`server/src/`) yang diubah, ditambah, atau dihapus.
- **Database SQLite:** File operasional `server/data/database.sqlite` terverifikasi utuh dengan SHA-256 identik:
  `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`
- **Upload Storage:** Direktori `server/uploads/` tidak tersentuh (51 file, 1,525,984 bytes).
- **Laporan Utama Phase 1B:** Dokumen `docs/audits/PHASE_1B_FRONTEND_API_CONSUMPTION_AUDIT.md` dipertahankan utuh tanpa penimpaan (overwriting). Addendum ini berdiri sebagai dokumen validasi komplementer.

---

## 3. Baseline yang Digunakan

Validasi addendum ini berpijak pada baseline yang terbukti valid:
- **Phase 1A & Phase 1A.1 Baseline:** 159 Active Express Route Registrations, 143 Strict Functional Contracts, 16 True Alias/Mount Replicas, 4 Operational Variants, 139 Coarse Capability Contracts, 8 Canonical Workflow Stages.
- **Phase 1B Findings Inventory:** 127 Request Call Sites, 24 Active Consumer Files, 73 Unique Frontend Endpoint Templates.
- **Source of Truth Rule:** Backend Express dan SQLite database adalah SSoT. Validasi membuktikan perilaku aktual kode, bukan asumsi antarmuka.

---

## 4. F-01 Pricing Validation — `POST /api/pricing/samsat`

### A. Verifikasi Backend Routing
Pemeriksaan terhadap `server/src/routes/pricingRoutes.ts` membuktikan route yang terdaftar untuk `/pricing/samsat`:
```typescript
// server/src/routes/pricingRoutes.ts:30-36
pricingRouter.get("/samsat", requireAuth, getSamsatItems);
pricingRouter.get("/samsat/:id", requireAuth, getSamsatItemById);
pricingRouter.put("/samsat/:id", requireAuth, requireFinanceOrSuperAdmin, validateBody(updateSamsatItemSchema), updateSamsatItem);
```
- **Route `POST /samsat` TIDAK ADA.**
- Controller `server/src/controllers/pricingController.ts` hanya memiliki `getSamsatItems`, `getSamsatItemById`, dan `updateSamsatItem`. Tidak ada fungsi handler `createSamsatItem` atau sejenisnya.
- `server/src/repositories/dbPricingRepository.ts:208` memang memiliki method `addSamsatItem(item: SamsatCostItem)`, namun method ini adalah artefak repository internal yang **tidak pernah diekspos melalui Express router**.

### B. Analisis Implementasi Frontend `addSamsatItem()`
Implementasi pada `src/data/api/apiPricingProvider.ts:184-201`:
```typescript
public addSamsatItem(item: Omit<SamsatCostItem, "id">): SamsatCostItem {
  const newItem: SamsatCostItem = {
    ...item,
    id: `custom-samsat-${Date.now()}`,
  };
  this.samsatItems.push(newItem);
  this.notify();

  fetch(`${this.baseUrl}/pricing/samsat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    body: JSON.stringify(newItem),
  }).catch((err) => {
    console.error("Failed to persist new samsat item:", err);
  });

  return newItem;
}
```

#### Urutan Operasi & Perilaku State:
1. **Optimistic Update:** Item baru langsung di-push ke array lokal `this.samsatItems` dan `this.notify()` langsung dipanggil sebelum request selesai.
2. **Unawaited Background Fetch:** Request dikirim tanpa `await` dan fungsi langsung me-return `newItem`.
3. **Missing `response.ok` Check:** Standar Fetch API **tidak me-reject promise saat menerima status HTTP 404 Not Found**. Fetch hanya me-reject jika terjadi network error (koneksi putus/DNS fail). Akibatnya, blok `.catch()` **tidak pernah dieksekusi** saat backend mengembalikan 404 Not Found!
4. **State Rollback:** Karena error 404 dianggap sukses oleh promise, array `this.samsatItems` **tidak di-rollback**.
5. **Error Feedback:** Pengguna tidak menerima toast error atau indikator kegagalan.
6. **Dampak Nyata:** Jika method ini dipanggil, data baru terlihat aktif di UI, namun **hilang permanen saat halaman di-refresh** karena database SQLite tidak pernah menyimpannya.

### C. Penelusuran Pemanggil di UI
Penelusuran menyeluruh membuktikan:
- Method `addSamsatItem()` didefinisikan pada interface `PricingProvider` (`src/domain/pricing/types.ts:246`) dan didelegasikan oleh `pricingRepository.ts:65`.
- Pada `src/app/data/pricingStore.ts:2914`, terdapat method `addSamsatItem()`, namun method ini menambahkan ke array memori `MASTER_PRICING_ITEMS` tanpa memanggil `pricingRepository.addSamsatItem()`.
- **Komponen UI Aktual (`src/app/components/HargaDasarSamsat.tsx`):**  
  Pengelolaan tarif Samsat beroperasi secara eksklusif pada **29 komponen kanonis nasional (`ALL_CANONICAL_ITEMS`)**. Pembaruan tarif nasional menggunakan dialog standar yang memanggil `pricingStore.updateNationalDefault()` -> `pricingRepository.updateSamsatItem(canonicalId, ...)` -> `PUT /api/pricing/samsat/:id`. Pembaruan tarif per-Samsat menggunakan `updateSamsatOperationalTariffsBatch()` -> `PUT /api/pricing/samsat-tariffs`.
- **Kesimpulan UI:** Tidak ada form atau tombol di antarmuka produksi saat ini yang memanggil `addSamsatItem()`. Ini adalah *latent orphan method* di data layer.

### D. Business Decision Required
> [!IMPORTANT]
> **Keputusan Bisnis:** Apakah staf operasional diperbolehkan membuat komponen biaya Samsat baru di luar 29 komponen kanonis yang sudah ada?  
> - **Opsi A (Strict Canonical Catalogue):** Item Samsat dibatasi hanya 29 komponen master data nasional. Method `addSamsatItem()` dihapus dari provider frontend.  
> - **Opsi B (Dynamic Samsat Items):** Operasional diizinkan menambah item kustom. Backend Express wajib mengimplementasikan route `POST /api/pricing/samsat` lengkap dengan skema validasi.

---

## 5. F-02 Finance Validation — Payment Identifier & Query Ambiguity

### A. Lokasi Pemanggilan Frontend
Ditemukan tepat 2 lokasi di `src/app/components/FinanceContent.tsx`:
1. **Baris 798-802 (Modal Pelunasan Tagihan):**
   ```typescript
   const invoiceNum = item.invoice || item.invoiceNo || item.orderNo;
   if (invoiceNum) {
     fetchWithTimeout(`${APP_CONFIG.apiBaseUrl}/finance/invoices/${encodeURIComponent(invoiceNum)}/payments`, ...)
   ```
2. **Baris 1218-1222 (Modal Pembatalan / Void Pembayaran):**
   ```typescript
   const invoiceNum = lunasTargetItem.invoice || lunasTargetItem.invoiceNo || lunasTargetItem.orderNo;
   if (invoiceNum) {
     fetchWithTimeout(`${APP_CONFIG.apiBaseUrl}/finance/invoices/${encodeURIComponent(invoiceNum)}/payments`, ...)
   ```

### B. Struktur Objek `item` Sumber Pemanggilan
- Objek `item` berasal dari `InvoiceBillingRecord` pada state `tagihanList` atau `invoices`.
- Pada `src/data/api/apiFinanceProvider.ts:72, 85` (method `normalizeInvoice`), field `invoiceNo` dan `invoice` **selalu terisi** dengan format string invoice resmi (`INV-...`) atau fallback `INV-${id}`.
- Namun, jika antarmuka membuka modal pelunasan melalui referensi order yang belum memiliki invoice resmi (misalnya order baru masuk pada tahap awal yang belum digenerate invoicenya), variabel `item.invoice` bernilai undefined sehingga fallback `item.orderNo` (misal `ORD-202611-001`) digunakan.

### C. Eksekusi Backend & Bukti Kegagalan Query
1. **Express Route (`server/src/routes/financeRoutes.ts:76`):**  
   `financeRouter.get("/invoices/:invoiceNo/payments", requireAuth, getInvoicePayments);`
2. **Controller & Service (`server/src/controllers/financeController.ts:50` & `financeService.ts:45`):**  
   Memanggil `dbFinanceRepository.getPaymentsByInvoiceNo(invoiceNo)`.
3. **Repository SQL Query (`server/src/repositories/dbFinanceRepository.ts:650`):**  
   ```sql
   SELECT * FROM invoice_payments WHERE invoice_no = ? ORDER BY id ASC
   ```
4. **Analisis Kolom SQLite:**  
   Tabel `invoice_payments` memiliki kolom terpisah: `invoice_no` (berisi nomor invoice `INV-...`) dan `order_no` (berisi nomor order `ORD-...`).
5. **Hasil Query saat Fallback ke `orderNo`:**  
   Eksekusi `WHERE invoice_no = 'ORD-202611-001'` mengembalikan array kosong `[]` (bukan error HTTP).
6. **Dampak Frontend:**  
   Pada baris 816, `payload.data.length > 0` bernilai false, sehingga frontend jatuh ke fallback lokal `item.riwayatPembayaran || []`. Pada baris 1229 (void), `setTargetPayments([])` menyebabkan daftar riwayat pembayaran yang dapat di-void tampak kosong.
7. **Fungsi Tersembunyi di Backend:**  
   Backend sebenarnya memiliki fungsi `dbFinanceRepository.getPaymentsByOrderNo(orderNo)` (`SELECT * FROM invoice_payments WHERE order_no = ?`). Fungsi ini digunakan internal oleh `orderCorrectionService.ts`, namun **TIDAK PERNAH DIBUATKAN ROUTE HTTP**.

### D. Rekomendasi Arah Perbaikan
- **Frontend-side:** Pastikan frontend hanya memanggil `/finance/invoices/:invoiceNo/payments` jika `item.invoiceNo` benar-benar berawalan `INV-`. Jangan pernah mengirim `orderNo` ke endpoint invoice.
- **Backend-side:** Buat route baru `GET /api/finance/orders/:orderNo/payments` yang memanggil `getPaymentsByOrderNo(orderNo)`, atau modifikasi query `getInvoicePayments` menjadi:
  `SELECT * FROM invoice_payments WHERE invoice_no = ? OR order_no = ?`

---

## 6. F-03 Timestamp Validation (API-06) — Granular Field Analysis

Audit forensik membantah klaim universal bahwa seluruh timestamp mengalami pergeseran 7 jam. Berdasarkan inspeksi langsung skema SQLite dan simulasi parsing JavaScript pada zona waktu WIB (`Asia/Jakarta`), berikut hasil evaluasi field-by-field:

### Tabel Evaluasi Field Timestamp

| Database Column | Database Generation | Stored Format di SQLite | API Serialization | Frontend Parsing & Display | Timezone Behavior | Klasifikasi Hasil |
|---|---|---|---|---|---|---|
| `orders.updated_at` | SQLite `datetime('now')` | `YYYY-MM-DD HH:MM:SS` (Contoh: `2026-11-06 18:23:14`) | String mentah tanpa `Z` | `new Date(updated_at)` di Order Tracking | ECMAScript menganggap string tanpa `T/Z` sebagai **Waktu Lokal WIB** | **CONFIRMED INCORRECT** (Mundur 7 Jam) |
| `order_status_history.waktu_transisi` | SQLite `datetime('now')` | `YYYY-MM-DD HH:MM:SS` (Contoh: `2026-11-04 14:47:06`) | String mentah tanpa `Z` | `new Date(waktu_transisi)` di Riwayat Status | Transisi jam 21:47 WIB (14:47 UTC) ditampilkan sebagai 14:47 WIB | **CONFIRMED INCORRECT** (Mundur 7 Jam) |
| `security_audit_logs.created_at` | SQLite trigger `datetime('now')` | `YYYY-MM-DD HH:MM:SS` (Contoh: `2026-11-06 15:35:56`) | String mentah tanpa `Z` | `new Date(created_at)` di Security Log | Log jam 22:35 WIB ditampilkan sebagai 15:35 WIB | **CONFIRMED INCORRECT** (Mundur 7 Jam) |
| `audit_logs.created_at` (App-generated) | Node.js `new Date().toISOString()` | `YYYY-MM-DDTHH:MM:SS.sssZ` (Contoh: `2026-11-06T18:19:04.025Z`) | ISO UTC dengan `Z` | `new Date(log.timestamp)` di `AuditLog.tsx:109` | Browser mengenali `Z` dan menambahkan +7 jam (menjadi 01:19:04 WIB) | **CORRECT** |
| `orders.tanggal_masuk_berkas` | Node.js `new Date().toISOString()` | `YYYY-MM-DDTHH:MM:SS.sssZ` (Contoh: `2026-11-04T14:47:23.491Z`) | ISO UTC dengan `Z` | `new Date(tanggalMasukBerkas)` | Browser mengonversi UTC ke WIB secara akurat (+7 jam) | **CORRECT** |
| `orders.created_at` | Input form / Date string | `YYYY-MM-DD` (Contoh: `2026-11-04`) | Date string murni | `formatDate(created_at)` | Format tanggal kalender bisnis, tidak memiliki komponen jam | **CORRECT** |
| `kas_kantor.tanggal` | Input form / Date string | `YYYY-MM-DD` (Contoh: `2026-11-04`) | Date string murni | Ditampilkan sebagai tanggal transaksi kas | Format kalender lokal bisnis | **CORRECT** |
| `invoice_payments.tanggal_bayar` | Input form / Date string | `YYYY-MM-DD` (Contoh: `2026-11-04`) | Date string murni | `formatDate(tanggal_bayar)` | Tanggal pembayaran kalender akurat | **CORRECT** |

### Pembuktian Matematika & Kode
```javascript
// Bukti Kasus 1: Kolom SQLite datetime('now')
const sqliteUtcString = "2026-11-04 14:47:06"; // Waktu kejadian nyata: 21:47:06 WIB (14:47:06 UTC)
const d1 = new Date(sqliteUtcString);
// d1.toString() di browser WIB menghasilkan:
// "Wed Nov 04 2026 14:47:06 GMT+0700 (Waktu Indonesia Barat)"
// Terbukti mundur 7 jam dari waktu nyata!

// Bukti Kasus 2: Kolom App-generated ISO
const appIsoString = "2026-11-04T14:47:06.000Z"; // Waktu kejadian nyata: 21:47:06 WIB
const d2 = new Date(appIsoString);
// d2.toString() di browser WIB menghasilkan:
// "Wed Nov 04 2026 21:47:06 GMT+0700 (Waktu Indonesia Barat)"
// Akurat!
```

---

## 7. F-04 Role/Jabatan Validation — Tracing & Authorization Boundary

### A. Tracing End-to-End
1. **Database Identity (`server/data/database.sqlite`):**  
   Tabel `users` menyimpan `jabatan: "SVP"` dan `role: "administrator"`.
2. **Backend Authentication (`server/src/services/authService.ts:108-114`):**  
   ```typescript
   const roleMap: Record<string, "administrator" | "finance" | "admin" | "messenger"> = {
     SVP: "administrator",
     ADMIN: "admin",
     FINANCE: "finance",
     MESSENGER: "messenger",
   };
   const role = roleMap[userEntity.jabatan] || "admin";
   ```
   Backend Express sendiri yang mengonversi `jabatan: "SVP"` menjadi `role: "administrator"` dalam token JWT!
3. **Frontend Session Normalization (`src/app/data/permissionStore.ts:46-53`):**  
   ```typescript
   export function normalizeRole(role: string | null | undefined): Role {
     if (!role) return "admin";
     const r = role.toLowerCase().trim();
     if (r === "administrator" || r === "svp") return "svp";
     if (r === "finance") return "finance";
     if (r === "messenger") return "messenger";
     return "admin";
   }
   ```
   Frontend menormalisasi `administrator` ke key `svp` strictly untuk mengambil konfigurasi tampilan `DEFAULT_PERMISSIONS.svp`.
4. **Proteksi Mutasi Role Permissions:**  
   - **Frontend (`src/app/data/permissionStore.ts:648`):**  
     `if (cleanRole === "svp" || cleanRole === "administrator") throw new Error("Hak akses role SVP bersifat absolut...");`  
     Frontend menolak menyimpan perubahan permission untuk SVP/administrator dan **tidak pernah mengirim request PUT `/permissions/svp`**.
   - **Backend (`server/src/controllers/permissionController.ts:36`):**  
     `if (role === "svp" || role === "administrator") return res.status(400).json({ error: { code: "IMMUTABLE_ROLE" } });`  
     Backend memiliki proteksi identik.
5. **Backend Authorization Enforcement:**  
   Seluruh endpoint terlindungi memverifikasi token JWT (`req.user.role`). Token JWT membawa `role: "administrator"` asli dari backend. Tidak ada endpoint yang memeriksa string `"svp"` dari frontend.

### B. Klasifikasi Akhir F-04
Temuan ini direklasifikasi dari *Potential Risk* menjadi **MATCH VIA CONTROLLED ARCHITECTURAL MAPPING** (Severity: **INFO / LOW**). Tidak ada kebocoran hak akses, tidak ada pengiriman string role tidak valid ke backend, dan otorisasi API terisolasi aman di middleware backend.

---

## 8. Workflow Delivery Gate Validation (Step 7 -> Step 8)

### A. Analisis Field Form vs Payload API
Pada verifikasi baseline Phase 1A.1, transisi ke Tahap 8 mensyaratkan:
- `deliveryStatus === "Dokumen Diserahkan"`
- `isReceived === true`
- `receiverName` tidak kosong
- Task berstatus `COMPLETED`
- Messenger ownership valid

### B. Bukti Transformasi Data di Frontend
1. **Form Input (`OrderTracking.tsx:2141-2150`):**  
   Form input menggunakan field `directHandoverData.recipientName`.
2. **Mapping ke Payload Advance (`OrderTracking.tsx:2157-2163`):**  
   ```typescript
   const updated = await advanceOrderAsync(orderNo, "Dokumen Telah Diterima", {
     deliveryStatus: "Dokumen Diserahkan",
     isReceived: true,
     receiverName: proof.recipientName, // <- FIELD EXPLICITLY MAPPED TO receiverName
     tanggalDiterima: dateStr,
     deliveryHandover: proof,
   });
   ```
3. **Mapping pada Messenger Adapter (`src/app/data/messengerTaskAdapter.ts:1592-1594 & 3010-3012`):**  
   ```typescript
   orderUpdates = {
     deliveryStatus: "Dokumen Diserahkan",
     isReceived: true,
     receiverName: cleanRecipient, // <- EXPLICITLY SET
     tanggalDiterima: new Date().toISOString().split("T")[0],
   };
   ```
4. **Validasi Backend (`server/src/services/orderService.ts:1500-1626`):**  
   Backend membaca `updates.receiverName` dan `updates.deliveryStatus` dan menyimpannya secara transaksional ke tabel `orders`.
5. **Task Status `COMPLETED` (`messengerTaskAdapter.ts:2507, 2871`):**  
   Saat serah terima disimpan, task messenger secara otomatis dimutasi statusnya menjadi `"COMPLETED"`.

### C. Kesimpulan Gate Delivery
Status gate delivery diklasifikasikan sebagai **MATCH VIA ADAPTER MAPPING**. Tidak ada mismatch nama field antara frontend dan backend; frontend secara sadar memetakan properti form `recipientName` menjadi kontrak kanonis `receiverName` pada payload HTTP.

---

## 9. Reclassification of 32 Unused Contracts

Seluruh 32 kontrak backend yang tidak dikonsumsi frontend dievaluasi satu per satu ke dalam 5 taksonomi arsitektural:

| No | Method + Path | Domain | Fungsi Bisnis | Consumer Search Evidence | Klasifikasi Baru | Alasan & Justifikasi Teknis | Potensi Dampak Bisnis |
|---|---|---|---|---|---|---|---|
| 1 | `GET /api/health` | System Health | Liveness probe container | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Route khusus health check Docker/Kubernetes container orchestrator. | Tidak ada (by design). |
| 2 | `GET /api/health/ready` | System Health | Readiness probe container | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Route khusus readiness check ketersediaan database connection. | Tidak ada (by design). |
| 3 | `GET /api/orders/:orderNo/status-history` | Order Lifecycle | Riwayat transisi status order | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend membaca array riwayat dari field `order.statusHistory` pada payload order. | Rendah (informasi sudah terpenuhi). |
| 4 | `POST /api/orders/:orderNo/request-correction` | Order Lifecycle | Pengajuan tiket koreksi order | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Backend menyediakan tata kelola revisi formal, tetapi form UI belum dibangun. | Sedang (staf tidak dapat mengajukan revisi resmi). |
| 5 | `POST /api/orders/:orderNo/verify-cost` | Order Lifecycle | Verifikasi biaya final order | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Verifikasi biaya disematkan langsung dalam payload advance stage ke Supervisi. | Tidak ada (sudah terakomodasi). |
| 6 | `GET /api/order-corrections` | Order Corrections | Daftar tiket koreksi order | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Inbox supervisi koreksi belum diintegrasikan ke antarmuka SPV. | Sedang (SPV tidak memiliki dashboard review revisi). |
| 7 | `GET /api/order-corrections/:id` | Order Corrections | Detail tiket koreksi order | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Detail tiket koreksi belum memiliki modal penampil di UI. | Sedang (review data revisi belum visual). |
| 8 | `POST /api/order-corrections/:id/review` | Order Corrections | Persetujuan/penolakan koreksi | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Tombol approve/reject revisi order belum ada di UI SPV. | Sedang (workflow revisi belum dapat ditutup via UI). |
| 9 | `GET /api/pricing/effective` | Pricing | Resolver tarif efektif Samsat | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Kalkulasi tarif efektif dihitung di sisi client store secara deterministik. | Rendah (kalkulasi lokal instan). |
| 10 | `GET /api/pricing/samsat/:id` | Pricing | Detail item biaya Samsat tunggal | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat seluruh 29 item via `GET /pricing/samsat` dan memfilter di memori. | Tidak ada (efisiensi network caching). |
| 11 | `GET /api/finance/laba-rugi` | Finance | Laporan rekapitulasi laba rugi | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Laporan laba rugi dihitung dari `GET /finance/profit` via `labaRugiCanonical.ts`. | Rendah (sudah ada modul kalkulator P&L). |
| 12 | `GET /api/finance/invoices/unpaid` | Finance | Filter daftar invoice belum lunas | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend mengambil seluruh invoice via `/invoices` dan memfilter status di tabel. | Tidak ada (filter client-side cepat). |
| 13 | `GET /api/finance/invoices/completed` | Finance | Filter daftar invoice lunas/selesai | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend mengambil seluruh invoice dan memfilter status di tab *Selesai*. | Tidak ada (filter client-side cepat). |
| 14 | `POST /api/finance/transfer/office-to-messenger` | Finance | Mutasi kas kantor ke messenger | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Mutasi kas saat ini dicatat sebagai entri terpisah di kas kantor dan kas messenger. | Sedang (risiko ketidakseimbangan jurnal kas). |
| 15 | `POST /api/finance/transfer/messenger-to-office` | Finance | Penyetoran kas messenger ke kantor | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Penyetoran kas belum memiliki form transfer otomatis dua arah di UI kasir. | Sedang (risiko rekonsiliasi kas manual). |
| 16 | `GET /api/documents/:id/download` | Documents | Stream download dokumen fisik | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend mengunduh dokumen via ticket-authenticated preview endpoint. | Tidak ada (dokumen tetap dapat diunduh). |
| 17 | `GET /api/users/:id` | Users | Detail pengguna tunggal by ID | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat seluruh daftar pengguna via `/users` dan mencari by ID di adapter. | Tidak ada (caching pengguna efisien). |
| 18 | `POST /api/users/file-deletion-jobs/:jobId/retry` | Users | Retry job hapus file GDPR | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Tombol retry job pembersihan berkas fisik belum diekspos di panel GDPR admin. | Rendah (kegagalan job hapus file jarang terjadi). |
| 19 | `GET /api/messenger/tasks/:orderNo` | Messenger | Detail tugas messenger spesifik | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat pool tugas penuh via `/orders/tasks/all` dan memfilter by `orderNo`. | Tidak ada (filter memori lokal). |
| 20 | `POST /api/messenger/reimbursements/:id/void` | Messenger | Pembatalan klaim reimbursement | 0 call sites di `src/` | **POTENTIAL MISSING INTEGRATION** | Kasir belum memiliki tombol void klaim reimbursement messenger di UI Finance. | Sedang (klaim salah catat harus diedit manual). |
| 21 | `GET /api/estimation/templates/:id` | Estimation | Detail template estimasi by ID | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat seluruh template via `/estimation/templates` ke store. | Tidak ada (semua template ter-cache). |
| 22 | `GET /api/wilayah` | Wilayah | Daftar hirarki wilayah Indonesia | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Data 34 provinsi dan kabupaten dibundel statis di `wilayahIndonesiaData.ts`. | Rendah (perubahan wilayah administratif jarang). |
| 23 | `GET /api/wilayah/provinces` | Wilayah | Daftar provinsi Indonesia | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Dibundel statis lokal untuk performa autocomplete offline. | Rendah. |
| 24 | `GET /api/wilayah/:kode` | Wilayah | Detail wilayah administratif by kode | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Dibundel statis lokal. | Rendah. |
| 25 | `GET /api/payment-methods/:id` | Payment Methods | Detail metode pembayaran by ID | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat seluruh metode pembayaran via `/payment-methods` ke store. | Tidak ada. |
| 26 | `GET /api/services/:id` | Services | Detail katalog layanan by ID | 0 call sites di `src/` | **NOT REQUIRED BY CURRENT SCOPE** | Frontend memuat seluruh layanan via `/services` ke store. | Tidak ada. |
| 27 | `GET /api/v1/public/services` | Public API | Katalog layanan publik pelanggan | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus consumer portal publik eksternal pelanggan. | Tidak ada (pemisahan aplikasi). |
| 28 | `GET /api/v1/public/samsat` | Public API | Daftar Samsat portal publik | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus consumer portal publik eksternal pelanggan. | Tidak ada (pemisahan aplikasi). |
| 29 | `GET /api/v1/public/pricing` | Public API | Estimasi biaya publik | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus kalkulator publik pelanggan eksternal. | Tidak ada (pemisahan aplikasi). |
| 30 | `POST /api/v1/public/orders` | Public API | Pembuatan order booking mandiri | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus booking online pelanggan publik. | Tidak ada (pemisahan aplikasi). |
| 31 | `GET /api/v1/public/orders/tracking` | Public API | Lacak order publik by nopol | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus tracking publik tanpa login. | Tidak ada (pemisahan aplikasi). |
| 32 | `GET /api/v1/public/orders/:orderNo/tracking` | Public API | Lacak detail order publik by nomor | 0 call sites di `src/` | **INTENTIONALLY UNUSED** | Kontrak khusus tracking publik dengan nomor order. | Tidak ada (pemisahan aplikasi). |

### Ringkasan Reklasifikasi
- **INTENTIONALLY UNUSED:** 8 Kontrak (2 Health Probes + 6 Public Portal APIs)
- **NOT REQUIRED BY CURRENT SCOPE:** 16 Kontrak (Single-resource getters, list filters, static bundled wilayah)
- **POTENTIAL MISSING INTEGRATION / BUSINESS DECISION REQUIRED:** 8 Kontrak (Order Corrections [4], Internal Transfers [2], Reimbursement Void [1], File Deletion Retry [1])
- **MISCLASSIFIED:** 0 Kontrak

---

## 10. Contract Classification Corrections

Tabel perbandingan status awal Phase 1B vs status akhir setelah addendum validasi:

| Item Temuan | Status Awal Phase 1B | Status Akhir Validasi Addendum | Severity | Justifikasi Perubahan |
|---|---|---|---|---|
| `POST /api/pricing/samsat` (F-01) | FRONTEND CALL WITH NO BACKEND ROUTE | **FRONTEND CALL WITH NO BACKEND ROUTE** | **HIGH** | Terbukti rute absen di Express; method adalah orphan di provider dan tidak dipanggil UI aktif. |
| `GET /api/finance/invoices/:invoiceNo/payments` (F-02) | PARTIAL | **PARTIAL** | **MEDIUM** | Terbukti query `WHERE invoice_no = ?` mengembalikan `[]` saat menerima `orderNo`; fungsi `getPaymentsByOrderNo` ada di repo tapi tanpa route. |
| Timestamps (API-06) (F-03) | PARTIAL (General Shift) | **SPLIT: CONFIRMED INCORRECT & CORRECT** | **HIGH** | Terbukti pergeseran 7 jam hanya terjadi pada kolom SQLite `datetime('now')` tanpa `Z`; kolom ISO dengan `Z` dan string tanggal kalender terbukti akurat. |
| Role vs Jabatan (F-04) | MATCH (Potential Drift) | **MATCH VIA CONTROLLED ARCHITECTURAL MAPPING** | **INFO** | Terbukti backend authService sendiri yang memetakan SVP ke administrator; frontend normalisasi hanya untuk UI menu; proteksi role mutasi identik. |
| Delivery Gate Step 7->8 | PARTIAL (Nama field berbeda) | **MATCH VIA ADAPTER MAPPING** | **LOW** | Terbukti frontend form menginput `recipientName` namun payload advance secara eksplisit memetakannya ke `receiverName`. |
| 32 Unused Contracts | UNUSED BACKEND CONTRACT (General) | **RECLASSIFIED INTO 3 DISTINCT DOMAINS** | **INFO / MED** | 8 Intentionally Unused, 16 Not Required, 8 Potential Missing Integration. |

---

## 11. Revised Audit Metrics

Untuk mencegah kerancuan antara evaluasi kontrak backend dan pemanggilan frontend, metrik dipisahkan secara tegas dengan rumus dan denominator masing-masing:

### A. Backend Contract Assessment Coverage
Mengukur kelengkapan evaluasi terhadap 143 Strict Functional Contracts backend:
$$\text{Backend Contract Coverage} = \frac{143 \text{ Kontrak Dievaluasi}}{143 \text{ Baseline SSoT}} \times 100\% = 100.00\%$$

### B. Backend Contract Consumption
Mengukur proporsi kontrak backend yang memiliki consumer pada dashboard admin:
$$\text{Active Consumed Contracts} = \frac{111 \text{ (110 MATCH + 1 PARTIAL)}}{143 \text{ Total Baseline Contracts}} \times 100\% = 77.62\%$$
$$\text{Unused Contracts} = \frac{32 \text{ Kontrak Unused}}{143 \text{ Total Baseline Contracts}} \times 100\% = 22.38\%$$

### C. Frontend Integration Alignment (Call Site Level)
Mengukur kesesuaian setiap pemanggilan jaringan frontend terhadap route backend yang valid:
$$\text{Frontend Call Alignment} = \frac{126 \text{ Call Sites Valid}}{127 \text{ Total Call Sites}} \times 100\% = 99.21\%$$
$$\text{Frontend Calls Without Route} = \frac{1 \text{ Call Site (F-01)}}{127 \text{ Total Call Sites}} \times 100\% = 0.79\%$$

---

## 12. Business Decisions Required

Keputusan bisnis yang memerlukan arahan resmi Technical Lead / Business Owner sebelum Phase 1C:
1. **Penetapan Katalog Komponen Samsat (F-01):**  
   Apakah sistem mempertahankan 29 komponen Samsat kanonis tertutup (hapus `addSamsatItem` dari provider), ataukah operasional membutuhkan penambahan komponen Samsat dinamis (buat route `POST /api/pricing/samsat` di backend)?
2. **Pencarian Pembayaran Finansial Pra-Invoice (F-02):**  
   Apakah pencarian riwayat pembayaran berbasis `orderNo` diperlukan sebelum nomor invoice diterbitkan? Jika ya, setujui penambahan route `GET /api/finance/orders/:orderNo/payments`.
3. **Aktivasi Workflow Koreksi Order (Order Corrections):**  
   Backend telah memiliki 4 endpoint supervisi koreksi order (`/api/order-corrections/*`). Apakah fitur ini akan dibuatkan antarmuka UI pada Phase 6, atau dipertahankan sebagai API-only governance?
4. **Aktivasi Transfer Internal Kas (Internal Transfers):**  
   Backend memiliki endpoint transfer kas dua arah (`/api/finance/transfer/*`). Apakah kasir memerlukan form transfer kas terintegrasi di UI untuk menggantikan pencatatan manual kas kantor/messenger?

---

## 13. Remaining Risks and Unverified Areas

- **Risiko Pergeseran Jam Operasional (F-03):** Transaksi dan perubahan status order yang terjadi antara pukul 00:00 hingga 06:59 WIB pada database SQLite akan tampak bergeser ke hari kalender sebelumnya di antarmuka web. Perbaikan serialisasi timestamp backend mendesak dilakukan pada fase perbaikan.
- **Lingkup Portal Publik Eksternal:** 6 kontrak `/api/v1/public/*` dikonfirmasi tidak digunakan di admin dashboard. Audit integrasi portal publik memerlukan repositori aplikasi customer terpisah yang berada di luar workspace ini.

---

## 14. Final Assessment — Phase 1B Approval Readiness

Dengan terbitnya Validation Addendum ini:
1. Seluruh temuan kritis (F-01, F-02, F-03, F-04, Delivery Gate) telah terbukti secara tuntas dengan nomor baris dan alur eksekusi statis.
2. Klasifikasi metrik telah dipisahkan secara transparan antara cakupan evaluasi backend (100%), konsumsi kontrak (77.62%), dan keselarasan pemanggilan frontend (99.21%).
3. Integritas sistem terbukti terjaga sempurna tanpa ada kode atau data operasional yang termutasi.

**STATUS KESIAPAN:**  
Phase 1B (**Frontend API Consumption Audit & Validation Addendum**) dinyatakan **SELESAI, LENGKAP, DAN LAYAK DISETUJUI** sebagai dasar resmi pelaksanaan **Phase 1C (Contract Gap Analysis & Alignment)**.

> [!IMPORTANT]
> **STOP — TAHAP ADDENDUM SELESAI.**  
> Tidak ada pengerjaan implementasi perbaikan atau transisi ke Phase 1C tanpa persetujuan eksplisit dari pengguna.
