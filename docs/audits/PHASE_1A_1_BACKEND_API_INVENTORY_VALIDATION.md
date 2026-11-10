# PHASE 1A.1 — BACKEND API INVENTORY VALIDATION ADDENDUM
## SUN89 / SUNBiroJasa Core Operational Platform

**Document Version:** 1.0.0 (Forensic Addendum)  
**Inspection Mode:** READ-ONLY FORENSIC AUDIT  
**Status:** COMPLETE — NO CODE OR DATABASE MODIFICATIONS AUTHORIZED  
**Audit Target:** `server/src/` (Express TypeScript Application)  
**Database Invariant:** `server/data/database.sqlite` (SHA-256: `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`)  
**Storage Invariant:** `server/uploads/` (51 files, 1,525,984 bytes)  
**Services Runtime:** Backend `http://localhost:3001` | Frontend `http://localhost:3000`

---

## 1. EXECUTIVE SUMMARY

Laporan ini merupakan **Addendum Validasi Empiris (Phase 1A.1)** terhadap laporan *Phase 1A — Backend API Inventory Report*. Addendum ini diterbitkan untuk menyelesaikan ketidakkonsistenan penghitungan rute, mengoreksi kekeliruan konseptual tahapan workflow (8 tahap vs 10 tahap), merinci kontrak upload dokumen multipart secara faktual, membongkar formula klaim kelengkapan skema (*contract completeness*), serta memverifikasi temuan divergensi izin pada rute alias berdasarkan kode aktual.

### Ringkasan Hasil Koreksi Utama

1. **Rekonsiliasi Angka Endpoint Terdaftar:**
   - **Router-Level Route Definitions:** **149 rute** didefinisikan pada 18 file router individual.
   - **Active Express Route Registrations:** **159 rute** aktif di Express app (termasuk mount ganda `auditRouter` [+$4$] dan `publicRouter` [+$6$]).
   - **Unique Method + Path:** **159 kombinasi unik**.
   - **Strict Functional Contracts:** **143 kontrak fungsional independen** ($159 - 16\text{ true alias/mount replicas} = 143$).
   - **Coarse Capability Contracts:** **139 kapabilitas bisnis makro** ($143 - 4\text{ operational variants} = 139$).
   - **True Alias & Mount Replicas:** **16 rute**.
   - **Operational Capability Variants:** **4 rute**.
2. **Koreksi Workflow (8 Tahap vs 10 Tahap) & Approval Gates:**
   - **Fakta Terbukti:** Backend secara definitif mengimplementasikan **8 CANONICAL STAGES** (`currentStep: 1..8`), didefinisikan dalam enum `STAGES` di [src/domain/order/types.ts:423-432](file:///d:/Admin/adminsunbirojasa/src/domain/order/types.ts#L423-L432) dan ditegakkan oleh state machine [server/src/services/orderService.ts:1482-1625](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1482-L1625).
   - **Approval Gates Aktual:**
     - Transisi Step 5 $\to$ 6 mewajibkan `documentApproval.stage5Verified === true` atau `documentsVerified === true` ([orderService.ts:1577-1591](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1577-L1591)).
     - Transisi Step 6 $\to$ 7 mewajibkan persetujuan resmi Supervisor/SVP (`documentApproval.stage6Approved === true` atau `approvedBySpv === true`) serta eksekutor berwenang `administrator` atau `jabatan === 'SVP'` ([orderService.ts:1527-1532, 1611-1624](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1527-L1532)).
     - Transisi Step 7 $\to$ 8 diselesaikan melalui penyelesaian serah terima kurir (`deliveryStatus: "Dokumen Diserahkan"`, `isReceived: true`, `receiverName`) atau advance ke terminal state `Dokumen Telah Diterima` ([orderService.ts:3140-3186](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L3140-L3186)).
   - **Kekeliruan Laporan Phase 1A:** Laporan Phase 1A sebelumnya keliru mengasumsikan 10 tahap karena mencampuradukkan tindakan pembayaran (*Pembayaran DP*, *Pelunasan*) dan estimasi biaya sebagai *tahap workflow*. Di backend, pembayaran dan verifikasi biaya adalah entitas ortogonal (approval gate/sub-status), bukan nomor tahapan workflow.
3. **Kontrak Upload Dokumen Multipart:**
   - Field file wajib: `file` (single file, buffer via Multer memory storage, max 10MB).
   - Field form-data teks: `orderNo` (opsional), `invoiceId` (opsional), `documentType` (opsional, default `"DOKUMEN_PENDUKUNG"`), `metadata` (opsional stringified JSON).
   - Dokumen **dapat diunggah tanpa orderNo** (unlinked document) dan ditautkan kemudian melalui `PATCH /api/documents/:id/link-order`.
   - Validasi biner mendalam memeriksa *magic bytes*, *EOF marker* (PDF & JPEG), struktur chunk (PNG IHDR/IEND, WebP RIFF), serta menolak ekstensi ganda dan signature PE/ELF/ZIP/RAR/7z.
4. **Metrik Kelengkapan Skema (Contract Completeness):**
   - Dari **143 Strict Functional Contracts**: **126 COMPLETE** (88.11%), **15 PARTIAL** (10.49%), **2 AMBIGUOUS** (1.40%), **0 UNDOCUMENTED** (0.00%).
   - Indeks kelengkapan tertimbang: **93.36%** (menggunakan denominator konsisten 143 endpoint fungsional independen).
5. **Verifikasi Temuan API-01 sampai API-06:**
   - **API-01 (CONFIRMED):** `DELETE /api/audit-logs` mensyaratkan `administrator`, sedangkan pemanggilan via alias `DELETE /api/audit` mengizinkan `administrator, svp, admin`.
   - **API-02 (CONFIRMED DENGAN KOREKSI):** Redundansi alias rute terbukti ada, namun `/api/finance/profit` terbukti memanggil fungsi controller terpisah (`getProfitList`), bukan alias dari `/laba-rugi`.
   - **API-03 (PARTIALLY CONFIRMED / REFUTED):** Pembuatan entitas hampir seluruhnya mengembalikan `201 Created`. Respons `200 OK` pada `POST` hanya terjadi jika idempotensi mendeteksi duplikat (`isExisting: true`) atau pada endpoint transisi status.
   - **API-04 (PARTIALLY CONFIRMED):** Validasi `PUT /api/services/:id` dan `PUT /api/estimation/templates/:id` tidak menggunakan middleware Express, melainkan ditegakkan secara imperatif di dalam service layer.
   - **API-05 (CONFIRMED):** Inkonsistensi dialek enum status antar domain terbukti ada.
   - **API-06 (CONFIRMED):** Timestamp SQLite menggunakan string lokal/UTC `datetime('now')`, sedangkan controller menggunakan ISO 8601 UTC (`.toISOString()`).

---

## 2. METODOLOGI DAN BATASAN AUDIT

### 2.1 Metodologi Forensik
Audit dilakukan secara statis (*source code inspection*) dan pembacaan pohon router Express langsung dari kode sumber:
1. Menelusuri seluruh deklarasi `app.use()`, `router.use()`, dan pemanggilan method router (`.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`).
2. Menghitung secara independen empat kategori hitungan:
   - *Raw Route Registrations:* Jumlah pemanggilan registrasi rute pada layer Express.
   - *Unique Method + Path:* Jumlah kombinasi unik antara HTTP Method dan absolute path setelah prefix `app.use()` diaplikasikan.
   - *Functional Contracts:* Jumlah kontrak fungsional setelah rute alias dan mount ganda dikelompokkan ke dalam satu kontrak kanonikal.
   - *Alias Count:* Jumlah rute alternatif sekunder yang merepresentasikan fungsionalitas yang sama.
3. Menelusuri logika transisi order di `orderService.ts` untuk memetakan alur workflow, prerequisite gating, dan terminal state.
4. Menelusuri middleware upload di `documentRoutes.ts`, `documentController.ts`, `fileValidation.ts`, dan `documentService.ts`.

### 2.2 Batasan Mutlak
- Mode audit adalah **READ-ONLY**. Tidak ada berkas di `server/src/`, `src/`, `tests/`, atau `public/` yang dimodifikasi, dibuat (selain laporan audit ini), dihapus, atau dipindahkan.
- Integritas database operasional SQLite (`server/data/database.sqlite`) terjaga dengan hash SHA-256: `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`.
- Folder berkas upload (`server/uploads/`) terjaga tepat pada 51 file aktif (1.525.984 bytes).

---

## 3. ROUTE COUNT RECONCILIATION

### 3.1 Definisi Hitungan
- **Raw Route Registrations (159):** Total seluruh registrasi rute yang dipasang ke instance router dan Express `app`. Terdiri dari 149 rute yang dideklarasikan pada router modules, ditambah 4 rute tambahan dari mount kedua `auditRouter` dan 6 rute tambahan dari mount kedua `publicRouter`.
- **Unique Method + Path (159):** Jumlah kombinasi HTTP Method dan URL path absolut yang dapat diakses oleh client HTTP.
- **Strict Functional Contracts (143):** Jumlah kontrak operasi bisnis kanonikal independen tingkat endpoint ($159 - 16\text{ alias} = 143$). Dua atau lebih endpoint yang mengeksekusi operasi bisnis dan handler yang sama persis (seperti rute alias atau path mount ganda) dikelompokkan ke dalam satu kontrak kanonikal.
- **Coarse Capability Contracts (139):** Pengelompokan tingkat kapabilitas bisnis makro ($159 - 20\text{ varian/alias} = 139$), di mana 4 rute varian operasional (varian query parameter dan pasangan arah transfer/reset) digabungkan ke induk kapabilitasnya.
- **True Alias & Mount Replicas (16):** Rute alternatif sekunder yang memiliki handler identik dan redundan murni.
- **Operational Variant Routes (4):** Rute yang memanggil handler yang sama atau berpasangan secara fungsional (dijelaskan pada Bagian 13).

### 3.2 Tabel Rekonsiliasi Per Domain

| Domain | Active Express Registrations | Unique Method + Path | Strict Functional Contracts | True Alias Count | Operational Variants | Coarse Capability Contracts | Source References |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. System Health & Probes** | 3 | 3 | 2 | 1 | 0 | 2 | [server/src/app.ts:87-91](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L87-L91) |
| **2. Authentication & Session** | 3 | 3 | 3 | 0 | 0 | 3 | [server/src/routes/authRoutes.ts:15-21](file:///d:/Admin/adminsunbirojasa/server/src/routes/authRoutes.ts#L15-L21) |
| **3. Order Lifecycle & Ops** | 33 | 33 | 31 | 2 | 1 | 30 | [server/src/routes/orderRoutes.ts:51-263](file:///d:/Admin/adminsunbirojasa/server/src/routes/orderRoutes.ts#L51-L263) |
| **4. Order Corrections & Review** | 3 | 3 | 3 | 0 | 0 | 3 | [server/src/routes/orderCorrectionRoutes.ts:16-23](file:///d:/Admin/adminsunbirojasa/server/src/routes/orderCorrectionRoutes.ts#L16-L23) |
| **5. Pricing & Samsat Tariffs** | 14 | 14 | 13 | 1 | 1 | 12 | [server/src/routes/pricingRoutes.ts:27-96](file:///d:/Admin/adminsunbirojasa/server/src/routes/pricingRoutes.ts#L27-L96) |
| **6. Finance & Accounting** | 23 | 23 | 22 | 1 | 1 | 21 | [server/src/routes/financeRoutes.ts:41-215](file:///d:/Admin/adminsunbirojasa/server/src/routes/financeRoutes.ts#L41-L215) |
| **7. Document Management** | 9 | 9 | 9 | 0 | 0 | 9 | [server/src/routes/documentRoutes.ts:46-68](file:///d:/Admin/adminsunbirojasa/server/src/routes/documentRoutes.ts#L46-L68) |
| **8. User Administration & Privacy** | 9 | 9 | 9 | 0 | 0 | 9 | [server/src/routes/userRoutes.ts:24-93](file:///d:/Admin/adminsunbirojasa/server/src/routes/userRoutes.ts#L24-L93) |
| **9. Employee Directory** | 6 | 6 | 6 | 0 | 0 | 6 | [server/src/routes/employeeRoutes.ts:20-65](file:///d:/Admin/adminsunbirojasa/server/src/routes/employeeRoutes.ts#L20-L65) |
| **10. Messenger Operations** | 8 | 8 | 8 | 0 | 0 | 8 | [server/src/routes/messengerRoutes.ts:22-83](file:///d:/Admin/adminsunbirojasa/server/src/routes/messengerRoutes.ts#L22-L83) |
| **11. Audit Trail Logging** | 8 | 8 | 3 | 5 | 0 | 3 | [server/src/routes/auditRoutes.ts:13-48](file:///d:/Admin/adminsunbirojasa/server/src/routes/auditRoutes.ts#L13-L48) & [app.ts:144-145](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L144-L145) |
| **12. Estimation Templates** | 5 | 5 | 5 | 0 | 1 | 4 | [server/src/routes/estimationRoutes.ts:19-42](file:///d:/Admin/adminsunbirojasa/server/src/routes/estimationRoutes.ts#L19-L42) |
| **13. Wilayah (Administrative Areas)**| 3 | 3 | 3 | 0 | 0 | 3 | [server/src/routes/wilayahRoutes.ts:13-15](file:///d:/Admin/adminsunbirojasa/server/src/routes/wilayahRoutes.ts#L13-L15) |
| **14. Samsat Offices** | 4 | 4 | 4 | 0 | 0 | 4 | [server/src/routes/wilayahRoutes.ts:18-28](file:///d:/Admin/adminsunbirojasa/server/src/routes/wilayahRoutes.ts#L18-L28) |
| **15. Notification Settings & Logs** | 4 | 4 | 4 | 0 | 0 | 4 | [server/src/routes/notificationRoutes.ts:18-47](file:///d:/Admin/adminsunbirojasa/server/src/routes/notificationRoutes.ts#L18-L47) |
| **16. RBAC Permissions Matrix** | 3 | 3 | 3 | 0 | 0 | 3 | [server/src/routes/permissionRoutes.ts:17-23](file:///d:/Admin/adminsunbirojasa/server/src/routes/permissionRoutes.ts#L17-L23) |
| **17. Payment Methods Catalog** | 5 | 5 | 5 | 0 | 0 | 5 | [server/src/routes/paymentMethodRoutes.ts:19-25](file:///d:/Admin/adminsunbirojasa/server/src/routes/paymentMethodRoutes.ts#L19-L25) |
| **18. Services Master Catalog** | 4 | 4 | 4 | 0 | 0 | 4 | [server/src/routes/serviceRoutes.ts:13-30](file:///d:/Admin/adminsunbirojasa/server/src/routes/serviceRoutes.ts#L13-L30) |
| **19. Public Portal & Tracking** | 12 | 12 | 6 | 6 | 0 | 6 | [server/src/routes/publicRoutes.ts:56-74](file:///d:/Admin/adminsunbirojasa/server/src/routes/publicRoutes.ts#L56-L74) & [app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **TOTAL KESELURUHAN** | **159** | **159** | **143** | **16** | **4** | **139** | **100% Terverifikasi Konsisten** |

---

## 4. CORRECTED ENDPOINT INVENTORY

Berikut adalah koreksi langsung terhadap endpoint-endpoint yang pada laporan Phase 1A sebelumnya tercatat keliru, tidak akurat, atau hilang:

### 4.1 Koreksi Domain Messenger (`server/src/routes/messengerRoutes.ts`)
- **Prefix Aktual:** `/api/messenger` (bukan `/api/messengers`).
- **Endpoint Terkoreksi:**
  1. `GET /api/messenger/messengers` (pada Phase 1A keliru ditulis `/api/messengers/stats`).
  2. `GET /api/messenger/history` (pada Phase 1A keliru ditulis `/api/messengers/history`).
  3. `GET /api/messenger/tasks/:orderNo` (pada Phase 1A keliru ditulis `/api/messengers/tasks/:taskId` dengan parameter `:taskId`).
  4. `PATCH /api/messenger/reimbursements/:id/review` (pada Phase 1A keliru dicatat sebagai method `PUT` dan prefix jamak).

### 4.2 Koreksi Domain Dokumen (`server/src/routes/documentRoutes.ts`)
- **Endpoint Terkoreksi:**
  1. `GET /api/documents/order/:orderNo` (pada Phase 1A ditulis `/by-order/:orderNo`).
  2. `GET /api/documents/invoice/:invoiceId` (pada Phase 1A ditulis `/by-invoice/:invoiceNo`).
  3. `POST /api/documents/:id/ticket` (pada Phase 1A ditulis `POST /api/documents/ticket` dengan body).
  4. `GET /api/documents/:id/preview` (pada Phase 1A ditulis `GET /api/documents/preview/:id`).
  5. `GET /api/documents/:id/download` (pada Phase 1A ditulis `GET /api/documents/download/:id`).
  6. `PATCH /api/documents/:id/link-order` (pada Phase 1A keliru ditulis sebagai `PUT /api/documents/:id/order`).

### 4.3 Koreksi Domain Order (`server/src/routes/orderRoutes.ts`)
- **Endpoint Terkoreksi:**
  1. `GET /api/orders/:orderNo/status-history` (pada Phase 1A ditulis `/:orderNo/history`).
  2. `DELETE /api/orders/:orderNo/archive` (pada Phase 1A hilang dari tabel matriks).
  3. `POST /api/orders/:orderNo/tasks/:taskType/accept` (parameter aktual adalah `:taskType`, bukan `:taskId`).
  4. `POST /api/orders/:orderNo/tasks/:taskType/decline` (parameter aktual adalah `:taskType`).
  5. `POST /api/orders/:orderNo/tasks/:taskType/reassign` (parameter aktual adalah `:taskType`).

### 4.4 Koreksi Domain Finance (`server/src/routes/financeRoutes.ts`)
- **Endpoint Terkoreksi:**
  1. `GET /api/finance/profit` memanggil controller `getProfitList` (bukan alias dari `/laba-rugi`).
  2. `POST /api/finance/invoices/:id/payments/:paymentId/void` (pada Phase 1A ditulis `POST /api/finance/payments/:id/void`).
  3. `POST /api/finance/invoices/:id/cashback-payout/void` (pada Phase 1A ditulis `POST /api/finance/cashback/:id/void`).
  4. `GET /api/finance/audit/void-history` (pada Phase 1A ditulis `/api/finance/void-history`).
  5. `DELETE /api/finance/kas-kantor/:id` (pada Phase 1A tidak tercatat).
  6. `DELETE /api/finance/kas-messenger/:id` (pada Phase 1A tidak tercatat).
  7. `POST /api/finance/transfer/messenger-to-office` dan `POST /api/finance/transfer/office-to-messenger` (pada Phase 1A keliru dirangkum sebagai `POST /api/finance/internal-transfer` dan `GET /kas-messenger/balance` yang tidak terdaftar di router).

### 4.5 Koreksi Domain Public & Tracking (`server/src/routes/publicRoutes.ts`)
- **Endpoint Terkoreksi:**
  1. `GET /api/v1/public/orders/tracking` (menerima `?nopol=...`, pada Phase 1A keliru ditulis `/tracking/:nopol`).
  2. `GET /api/v1/public/orders/:orderNo/tracking` (pada Phase 1A keliru ditulis `/tracking/detail/:orderNo`).

---

## 5. ORDER WORKFLOW RECONCILIATION

### 5.1 Bukti Kode: 8 Tahap vs 10 Tahap

Berdasarkan pemeriksaan mendalam terhadap kode sumber:
1. Enum kanonikal workflow didefinisikan secara tegas di [src/domain/order/types.ts:423-432](file:///d:/Admin/adminsunbirojasa/src/domain/order/types.ts#L423-L432):
   ```typescript
   export const STAGES = [
     "Verifikasi",              // Step 1
     "Penjadwalan",             // Step 2
     "Verifikasi Dokumen",      // Step 3
     "Proses Samsat",           // Step 4
     "Verifikasi Ulang",        // Step 5
     "Supervisi",               // Step 6
     "Pengantaran",             // Step 7
     "Dokumen Telah Diterima",  // Step 8
   ] as const;
   ```
2. Property `currentStep` pada [src/domain/order/types.ts:193](file:///d:/Admin/adminsunbirojasa/src/domain/order/types.ts#L193) secara eksplisit berbunyi:
   `currentStep: number; // 1 to 8`
3. Logika validasi transisi di [server/src/services/orderService.ts:1483-1486](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1483-L1486) memvalidasi `currentStep` dalam rentang $1 \le \text{currentStep} \le 8$.
4. Terminal Step Guard di [server/src/services/orderService.ts:1488-1497](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1488-L1497) mengunci order pada Step 8 (`Dokumen Telah Diterima`):
   ```typescript
   if (currentStep === 8 || existing.currentStageName === "Dokumen Telah Diterima") {
     if (targetStage !== "Dokumen Telah Diterima") {
       throw new ApiError(400, "INVALID_STAGE_TRANSITION",
         `Order '${orderNo}' sudah berada pada tahap selesai (Dokumen Telah Diterima) dan tidak dapat dimajukan lagi.`);
     }
   }
   ```

### 5.2 Tabel State Machine 8 Tahap Aktual

| Urutan (Step) | Status / Stage Aktual | Transisi Masuk | Transisi Keluar | Syarat / Gating Prasyarat | Source Code |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `Verifikasi` | Order Intake (`POST /api/orders` atau `POST /api/v1/public/orders`) | `Penjadwalan` (Normal) atau `Verifikasi Dokumen` (Walk-in) | Order dibuat, data customer & nopol valid | `orderService.ts:1482-1525` |
| **2** | `Penjadwalan` | Dari Step 1 (`Verifikasi`) | `Verifikasi Dokumen` (Step 3) | Petugas mengalokasikan messenger jemput | `orderService.ts:1534-1549` |
| **3** | `Verifikasi Dokumen` | Dari Step 2, atau langsung dari Step 1 via **Datang Langsung Shortcut** | `Proses Samsat` (Step 4) | Penjemputan selesai (`pickupCompleted: true` atau `messengerTaskStatus === 'Dokumen Sudah Tersedia'`) | `orderService.ts:1551-1563` |
| **4** | `Proses Samsat` | Dari Step 3 (`Verifikasi Dokumen`) | `Verifikasi Ulang` (Step 5) | Berkas fisik terverifikasi (`documentsVerified: true`) | `orderService.ts:1565-1575` |
| **5** | `Verifikasi Ulang` | Dari Step 4 (`Proses Samsat`) | `Supervisi` (Step 6) | Seluruh komponen Samsat selesai (`validateSamsatCompletion`) DAN berkas diperiksa (`stage5Verified` / `documentsVerified`) | `orderService.ts:1565-1591` |
| **6** | `Supervisi` | Dari Step 5 (`Verifikasi Ulang`) | `Pengantaran` (Step 7) | Persetujuan resmi SPV/SVP (`stage6Approved` / `approvedBySpv`) DAN eksekutor adalah Administrator atau Jabatan SVP | `orderService.ts:1527-1532, 1611-1624` |
| **7** | `Pengantaran` | Dari Step 6 (`Supervisi`) | `Dokumen Telah Diterima` (Step 8) | Kurir menyerahkan berkas (`deliveryStatus: 'Dokumen Diserahkan'`, `isReceived: true`, `receiverName` terisi) | `orderService.ts:3140-3186` |
| **8** | `Dokumen Telah Diterima` | Dari Step 7 (`Pengantaran`) | Terminal State (Arsip) | Terminal state terkunci: order tidak dapat dimajukan lagi | `orderService.ts:1488-1497` |

### 5.3 Rekonsiliasi Aturan Approval Gate (Transisi Step 5 s/d Step 8)

Pemeriksaan mendalam terhadap logika validasi state machine di [`server/src/services/orderService.ts`](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts) mengungkap fungsi aktual dari flag `stage5Verified`, `stage6Approved`, dan `approvedBySpv`:

| Transisi | Kondisi yang Diperiksa di Kode Sumber | Flag yang Wajib Terpenuhi | Role yang Berwenang | Source File & Nomor Baris |
| :--- | :--- | :--- | :--- | :--- |
| **Step 5 $\to$ Step 6**<br>(*Verifikasi Ulang* $\to$ *Supervisi*) | `updates.documentApproval?.stage5Verified \|\| existing.documentApproval?.stage5Verified \|\| updates.documentsVerified \|\| existing.documentsVerified` | `documentApproval.stage5Verified === true`<br>ATAU<br>`documentsVerified === true` | **Persetujuan Dokumen:** `administrator`, `admin`, `svp`, `supervisor` via `approveOrderDocuments(orderNo, 5)`.<br>**Eksekusi Advance:** Staf berwenang via stage authority. | [server/src/services/orderService.ts:1577-1591](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1577-L1591)<br>[server/src/services/orderService.ts:1879-1910](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1879-L1910) |
| **Step 6 $\to$ Step 7**<br>(*Supervisi* $\to$ *Pengantaran*) | 1. **Caller Authority:** `user.role === "administrator" \|\| user.jabatan === "SVP"`<br>2. **Approval Gate:** `existing.documentApproval?.stage6Approved \|\| existing.approvedBySpv \|\| (isSpvCaller && (safeAdvanceUpdates.documentApproval?.stage6Approved \|\| safeAdvanceUpdates.approvedBySpv))` | `documentApproval.stage6Approved === true`<br>ATAU<br>`approvedBySpv === true`<br>*(Disetel atomik bersama `spvApprovedAt` dan `spvName`)* | **Persetujuan Dokumen:** Wajib Supervisor/SVP (`administrator`, `svp`, `supervisor`). Admin biasa **ditolak 403 Forbidden**.<br>**Eksekusi Advance:** Wajib `administrator` atau `jabatan === 'SVP'`. | [server/src/services/orderService.ts:1527-1532](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1527-L1532)<br>[server/src/services/orderService.ts:1611-1624](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1611-L1624)<br>[server/src/services/orderService.ts:1872-1913](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1872-L1913) |
| **Step 7 $\to$ Step 8**<br>(*Pengantaran* $\to$ *Dokumen Telah Diterima*) | 1. **Penyelesaian Kurir:** `completeDeliveryTask` memvalidasi `existing.currentStep === 7`, `assertMessengerOwnership`, dan `receiverName` tidak kosong.<br>2. **Advance Sekuensial:** `advanceOrder` ke target `Dokumen Telah Diterima`. | `deliveryStatus === "Dokumen Diserahkan"`<br>`isReceived === true`<br>`receiverName` non-kosong<br>`taskAcceptance["Pengantaran Dokumen"].status === "COMPLETED"` | **Penyelesaian Serah Terima:** Kurir yang ditugaskan (`assertMessengerOwnership`).<br>**Eksekusi Advance:** `administrator`, `admin`, `svp`. | [server/src/services/orderService.ts:3140-3204](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L3140-L3204)<br>[server/src/services/orderService.ts:1482-1525](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1482-L1525) |
| **Step 8 (Terminal)**<br>(*Dokumen Telah Diterima*) | Terminal Step Guard: `if (currentStep === 8 \|\| existing.currentStageName === "Dokumen Telah Diterima")` melempar `INVALID_STAGE_TRANSITION` jika target bukan `Dokumen Telah Diterima`. | Order berstatus final dan terkunci secara permanen dari advance lanjutan. | Tidak ada (Terminal State). | [server/src/services/orderService.ts:1488-1497](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1488-L1497) |

### 5.4 Jawaban Eksplisit Pertanyaan Validasi B

1. **Apakah backend benar-benar memiliki 8 atau 10 tahap?**  
   **JAWABAN:** Backend **100% memiliki 8 tahap kanonikal** (Step 1 sampai Step 8). Tidak ada implementasi teknis untuk 10 tahap di backend. Klaim 10 tahap pada Phase 1A adalah kekeliruan analisis.
2. **Apakah ada status tambahan yang bukan bagian dari lifecycle utama?**  
   **JAWABAN:** Ya. Terdapat status operasional non-sekuensial:
   - `Dibatalkan` (`isCancelled: true`): Status pembatalan order dari tahap mana pun.
   - `Diarsipkan` (`isArchived: 1`): Status penyimpanan order pasca selesai.
   - `Kendala Samsat` (`samsatPickupStatus: "Terkendala"`): Sub-status masalah operasional di lapangan pada Step 4.
3. **Apakah ada tahap yang hanya berupa approval flag atau sub-status?**  
   **JAWABAN:** Ya. Elemen yang sebelumnya disalahartikan sebagai "tahap" pada Phase 1A sebenarnya adalah approval flag:
   - *Estimasi Biaya:* Properti snapshot keuangan (`costSnapshot`, `costCompletenessStatus: 'PARTIAL_ESTIMATE'`).
   - *Pembayaran DP & Pelunasan:* State pada tabel `finance_invoices` (`UNPAID`, `PARTIAL`, `PAID`) dan `finance_payments` (`MENUNGGU_VERIFIKASI`, `VERIFIED`).
   - *Persetujuan Berkas Supervisi:* Flag boolean `stage6Approved` dan `approvedBySpv`.
4. **Apakah status historis masih kompatibel dengan definisi workflow saat ini?**  
   **JAWABAN:** Ya. Database SQLite menyimpan nama tahap string (`stage_name`) pada `order_status_history`. Penerjemah publik di [server/src/controllers/publicController.ts:605-616](file:///d:/Admin/adminsunbirojasa/server/src/controllers/publicController.ts#L605-L616) menyediakan mekanisme *fallback* mundur untuk menangani string historis lama tanpa merusak integritas data.
5. **Apa aturan transisi yang benar-benar diberlakukan oleh backend?**  
   **JAWABAN:**
   - Transisi maju (`/advance`) **wajib sekuensial** ($N \to N+1$), kecuali satu pengecualian: order `Datang Langsung` diizinkan melompat dari Step 1 langsung ke Step 3 ([server/src/services/orderService.ts:1516](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L1516)).
   - Transisi mundur (`/rollback`) tidak boleh dipanggil melalui `/advance` dan mewajibkan otorisasi role manajerial (`administrator`, `admin`, `svp`, `supervisor`).
   - Order yang sudah berstatus `Dokumen Telah Diterima` (Step 8) dikunci dan tidak dapat dimajukan lagi.

---

## 6. DOCUMENT UPLOAD CONTRACT

Pemeriksaan aktual terhadap `server/src/routes/documentRoutes.ts`, `server/src/controllers/documentController.ts`, `server/src/services/documentService.ts`, dan `server/src/utils/fileValidation.ts` menghasilkan spesifikasi kontrak faktual:

### 6.1 Spesifikasi Endpoint Upload (`POST /api/documents/upload`)
- **HTTP Method & Path:** `POST /api/documents/upload`
- **Content-Type:** `multipart/form-data`
- **Authentication:** Wajib Bearer JWT (`requireAuth`).
- **Rate Limiting:** `uploadRateLimiter` (30 uploads / 15 menit per IP).
- **Multipart Fields:**
  - `file` (**Wajib**): Berkas biner tunggal (`upload.single("file")`), disangga dalam RAM (`Multer.memoryStorage()`). Batas ukuran maksimal: `CONFIG.MAX_FILE_SIZE_BYTES` (10.485.760 bytes / 10MB).
  - `orderNo` (**Opsional**, alias: `order_no`): String nomor order. Jika diisi, diverifikasi ke `dbOrderRepository.getByOrderNo()`. Jika order tidak ditemukan, melempar HTTP 404 `ORDER_NOT_FOUND`. Jika dikosongkan, dokumen tersimpan sebagai dokumen bebas (*unlinked*).
  - `invoiceId` (**Opsional**, alias: `invoice_id`): String nomor invoice. Jika diisi, diverifikasi ke `dbFinanceRepository.getInvoiceByNo()`. Jika tidak ditemukan, melempar HTTP 404 `INVOICE_NOT_FOUND`.
  - *Integritas Relasi Silang:* Jika `orderNo` dan `invoiceId` disertakan bersamaan, sistem memvalidasi bahwa `invoice.orderNo === orderNo`. Jika tidak cocok, melempar HTTP 400 `INVOICE_ORDER_MISMATCH`.
  - `documentType` (**Opsional**, alias: `type`, `tipe_dokumen`): String jenis dokumen. Default: `"DOKUMEN_PENDUKUNG"`.
  - `metadata` (**Opsional**): String format JSON.
- **Validasi Keamanan Berkas:**
  - Pre-filter ekstensi berbahaya: `.exe`, `.dll`, `.bat`, `.cmd`, `.sh`, `.php`, `.js`, `.mjs`, `.vbs`, `.ps1`, `.jar`, `.msi`, `.scr`, `.com`, `.phtml`.
  - Mime Type yang diizinkan: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
  - Ekstensi yang diizinkan: `.pdf`, `.jpg`, `.png`, `.webp`.
  - *Magic Bytes & Structural Inspection:*
    - PDF: Wajib diawali `%PDF-` (`0x25 0x50 0x44 0x46`), panjang minimum 64 byte, wajib mengandung marker `%%EOF` pada 1024 byte terakhir.
    - PNG: Wajib diawali signature 8-byte (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`), memvalidasi chunk IHDR dan chunk terminator IEND.
    - JPEG: Wajib diawali marker SOI (`0xFF 0xD8`), memvalidasi marker EOI (`0xFF 0xD9`) pada 1024 byte terakhir.
    - WebP: Wajib diawali `RIFF....WEBP` dengan chunk payload VP8, VP8L, atau VP8X.
    - Menolak berkas biner PE (Windows EXE/DLL), ELF, ZIP, RAR, 7z, Java Class, Mach-O.
    - Menolak serangan ekstensi ganda (misal `file.php.jpg`).

### 6.2 Contoh Kontrak Request & Response Upload

**Multipart Form-Data Request:**
```http
POST /api/documents/upload HTTP/1.1
Host: localhost:3001
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="ktp_pemilik.jpg"
Content-Type: image/jpeg

<binary jpeg bytes>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="orderNo"

ORD-20261109-0001
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="documentType"

KTP
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

**Success Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Dokumen berhasil diunggah dan disimpan secara permanen.",
  "data": {
    "id": "doc-1762700000000-a1b2c3",
    "orderNo": "ORD-20261109-0001",
    "invoiceId": null,
    "documentType": "KTP",
    "originalName": "ktp_pemilik.jpg",
    "storedName": "1762700000000-a1b2c3d4e5.jpg",
    "filePath": "server/uploads/1762700000000-a1b2c3d4e5.jpg",
    "fileSize": 245120,
    "mimeType": "image/jpeg",
    "fileHash": "<SHA256_OF_ACTUAL_FILE_BYTES>",
    "uploadedById": "usr-emp-001",
    "uploadedByName": "Budi Santoso",
    "createdAt": "2026-11-09T21:30:00.000Z",
    "isActive": true
  },
  "timestamp": "2026-11-09T21:30:00.123Z"
}
```

### 6.3 Mekanisme Akses & Tiket Sementara (Ticket Mechanism)
1. **Penerbitan Tiket:** `POST /api/documents/:id/ticket`
   - Otorisasi: `administrator`, `svp`, `finance` memiliki akses penuh; `admin` terbatas pada dokumen order/milik sendiri; `messenger` dibatasi ketat hanya untuk order yang ditugaskan secara kanonikal kepadanya ([server/src/controllers/documentController.ts:117-139](file:///d:/Admin/adminsunbirojasa/server/src/controllers/documentController.ts#L117-L139)).
   - Respons (HTTP 201): `{ success: true, data: { ticket: string, expiresInSeconds: 60, documentId: string } }`.
2. **Preview Berkas:** `GET /api/documents/:id/preview?ticket=<token>`
   - Header: Menghapus `X-Frame-Options` dan menyetel `Content-Security-Policy: ... frame-ancestors 'self' ...` agar dapat di-embed secara aman di `<iframe>` aplikasi frontend.
   - Header: `Content-Disposition: inline; filename="..."`.
3. **Download Berkas:** `GET /api/documents/:id/download?ticket=<token>`
   - Header: `Content-Disposition: attachment; filename="..."` dan `Content-Security-Policy: default-src 'none'; sandbox;`.

---

## 7. REQUEST/RESPONSE SCHEMA COMPLETENESS

### 7.1 Metodologi & Klasifikasi Evaluasi
Evaluasi kelengkapan kontrak dilakukan terhadap **143 Strict Functional Contracts** (seluruh endpoint fungsional mandiri setelah mengabaikan 16 rute duplikat mount dan alias ejaan murni). Setiap unit dievaluasi berdasarkan kriteria objektif:
- **COMPLETE:** Endpoint memiliki tipe data TypeScript eksplisit, skema request/response terdefinisi secara utuh, status code HTTP jelas, penanganan otorisasi lengkap, dan error handler tertangani.
- **PARTIAL:** Endpoint berfungsi dengan baik, namun menerima `req.body` atau query parameter tanpa validasi skema tipe data ketat pada layer routing/middleware (mengandalkan parsing ad-hoc atau validasi imperatif di service layer).
- **AMBIGUOUS:** Terdapat perilaku atau aturan izin yang berbeda tergantung rute akses atau method HTTP.
- **UNDOCUMENTED:** Endpoint aktif yang tidak tercatat dalam kode router atau tidak memiliki handler jelas.

### 7.2 Hasil Penghitungan Distribusi (Denominator = 143 Strict Contracts)

```
Total Strict Functional Contracts Evaluated : 143
├── COMPLETE                                 : 126 endpoints (88.11%)
├── PARTIAL                                  :  15 endpoints (10.49%)
├── AMBIGUOUS                                :   2 endpoints ( 1.40%)
└── UNDOCUMENTED                             :   0 endpoints ( 0.00%)
```

*(Catatan perbandingan: Jika dinilai pada level 139 Coarse Capability Contracts di mana 4 varian operasional digabung ke kapabilitas induknya, distribusinya adalah 122 Complete, 15 Partial, 2 Ambiguous).*

### 7.3 Rincian Endpoint PARTIAL (15 Endpoints)
1. `GET /api/orders`: Query params `page`, `limit`, `status`, `search` di-cast secara ad-hoc tanpa Express validator middleware.
2. `DELETE /api/pricing/samsat-tariffs`: Query params `samsatId` dan `pricingItemId` dibaca langsung dari `req.query` tanpa schema validator.
3. `PUT /api/services/:id`: Body tidak divalidasi oleh middleware validator (divalidasi secara imperatif di service).
4. `PUT /api/estimation/templates/:id`: Parameter formula numerik divalidasi imperatif di service.
5. `PUT /api/samsat/offices/:id`: Parsing body langsung di controller tanpa skema validator middleware.
6. `PUT /api/payment-methods/:id`: Properti body langsung diteruskan ke repository.
7. `POST /api/audit-logs`: Menerima metadata arbitrer tanpa pembatasan key.
8. `PUT /api/permissions/:role`: Array permission divalidasi di controller tanpa JSON Schema middleware.
9. `PUT /api/notifications/settings`: Konfigurasi SMTP divalidasi parsial.
10. `GET /api/finance/invoices`: Query filter numerik dan tanggal di-cast tanpa validasi format tanggal strict.
11. `GET /api/finance/kas-kantor`: Query pagination di-cast tanpa validator.
12. `GET /api/finance/pengeluaran`: Query pagination di-cast tanpa validator.
13. `GET /api/finance/kas-messenger`: Query pagination di-cast tanpa validator.
14. `GET /api/messenger/history`: Query pagination di-cast tanpa validator.
15. `GET /api/audit-logs`: Query filtering di-cast tanpa validator.

### 7.4 Rincian Endpoint AMBIGUOUS (2 Endpoints)
1. `DELETE /api/audit-logs` vs `DELETE /api/audit`: Divergensi izin role (`administrator` saja vs `administrator, svp, admin`).
2. `PUT /api/pricing/samsat-tariffs` vs `POST /api/pricing/samsat-tariffs`: Dua method berbeda mengeksekusi fungsi controller yang identik (`updateSamsatOperationalTariffs`).

### 7.5 Formula & Perhitungan Indeks Kelengkapan

1. **Strict Complete Rate:**
   $$\text{Strict Complete Rate} = \frac{\text{COMPLETE}}{\text{Total Strict Contracts}} \times 100\% = \frac{126}{143} \times 100\% = \mathbf{88.11\%}$$

2. **Weighted Completeness Index (Formula Tertimbang Transparan):**
   $$\text{Weighted Index} = \frac{\text{COMPLETE} + (0.5 \times \text{PARTIAL})}{\text{Total Strict Contracts}} \times 100\%$$
   $$\text{Weighted Index} = \frac{126 + (0.5 \times 15)}{143} \times 100\% = \frac{126 + 7.5}{143} \times 100\% = \frac{133.5}{143} \times 100\% = \mathbf{93.36\%}$$

Klaim 98% tanpa dasar pada laporan awal Phase 1A secara resmi dikoreksi menjadi **93.36% (Weighted Index)** dan **88.11% (Strict Complete)** berdasarkan denominator 143 unit endpoint yang tervalidasi.

---

## 8. PERMISSION AND ROUTE ALIAS COMPARISON

### 8.1 Matriks Perbandingan Detail Endpoint Alias

| Rute Primer | Rute Alias | Handler | Middleware / Auth | Perbedaan Permission / Parameter | Dampak Perilaku |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DELETE /api/audit-logs` | `DELETE /api/audit` | `auditController.clearAuditLogs` | `requireAuth` | **PRIMER:** `administrator` saja.<br>**ALIAS:** `administrator`, `svp`, `admin`. | **Privilege Elevation Vector:** Client non-superadmin yang diblokir di primer dapat menghapus log via alias! |
| `DELETE /api/audit-logs` | `POST /api/audit-logs/clear` | `auditController.clearAuditLogs` | `requireAuth` | **PRIMER:** `administrator` saja.<br>**VERB ALIAS:** `administrator`, `svp`, `admin`. | `POST /clear` meloloskan admin/svp pada prefix `/audit-logs`. |
| `GET /api/orders/archived` | `GET /api/orders/archive` | `orderController.getArchivedOrders` | `requireAuth` | Identik (tidak ada perbedaan izin). | Redundansi URL murni. |
| `DELETE /api/orders/archive/clear-all` | `DELETE /api/orders/archived/clear-all` | `orderController.clearAllArchivedOrders` | `requireAuth`, `requireRoles("administrator", "admin", "svp")` | Identik (tidak ada perbedaan izin). | Redundansi URL murni. |
| `GET /api/finance/laba-rugi` | `GET /api/finance/pnl` | `financeController.getLabaRugiSummary` | `requireAuth`, `requireRoles("administrator", "finance", "svp", "admin")` | Identik (tidak ada perbedaan izin). | Redundansi URL murni. |
| `PUT /api/pricing/samsat-tariffs` | `POST /api/pricing/samsat-tariffs` | `pricingController.updateSamsatOperationalTariffs`| `requireAuth`, `requireRoles("administrator", "admin")` | Identik (hanya verb HTTP berbeda). | Pelanggaran semantik REST (POST dipakai untuk update). |
| `/api/v1/public/*` (6 routes) | `/api/public/*` (6 routes) | `publicController.*` | `publicGeneralRateLimiter` (Public) | Identik (kedua prefix memuat router yang sama persis). | Redundansi namespace API versi lama vs versi baru. |

---

## 9. VALIDATION TEMUAN API-01 SAMPAI API-06

### API-01: Divergensi Izin pada Endpoint Audit Log Deletion
- **Status Validasi:** **CONFIRMED**
- **Bukti Implementasi:** [server/src/routes/auditRoutes.ts:31-41](file:///d:/Admin/adminsunbirojasa/server/src/routes/auditRoutes.ts#L31-L41):
  ```typescript
  auditRouter.delete("/", requireAuth, (req, res, next) => {
    if (req.baseUrl?.includes("audit-logs")) {
      return requireRoles("administrator")(req, res, next);
    }
    return requireRoles("administrator", "svp", "admin")(req, res, next);
  }, clearAuditLogs);
  ```
- **Dampak Teknis:** Celah eskalasi hak akses horizontal di mana pengguna dengan role `admin` atau `svp` dapat melewati proteksi penghapusan log audit cukup dengan memanggil URL alias `/api/audit` alih-alih `/api/audit-logs`.
- **Rekomendasi Perbaikan:** Memerlukan perubahan backend pada fase remediasi untuk menyamakan aturan izin secara ketat (`administrator` only).

### API-02: Redundansi Rute Alias Tanpa Header Deprecation
- **Status Validasi:** **CONFIRMED DENGAN KOREKSI**
- **Bukti Implementasi:** Ditemukan pada `app.ts` (`/api/public` vs `/api/v1/public`, `/api/audit` vs `/api/audit-logs`), `orderRoutes.ts` (`/archive` vs `/archived`), dan `financeRoutes.ts` (`/pnl` vs `/laba-rugi`).
- **Koreksi:** Rute `/api/finance/profit` terbukti **bukan alias**, melainkan memanggil handler berbeda `getProfitList`.
- **Dampak Teknis:** Frontend berpotensi memanggil rute yang berbeda-beda secara tidak konsisten, menyulitkan monitoring gateway.
- **Rekomendasi Perbaikan:** Backend perlu menyematkan header `Deprecation: true` pada rute sekunder sebelum nantinya dihapus.

### API-03: Perbedaan HTTP Status Code untuk Operasi Pembuatan Data (200 vs 201)
- **Status Validasi:** **PARTIALLY CONFIRMED / REFUTED**
- **Bukti Implementasi:**
  - `createOrder`: Mengembalikan `201` untuk order baru dan `200` jika idempotent retry ([server/src/controllers/orderController.ts:103](file:///d:/Admin/adminsunbirojasa/server/src/controllers/orderController.ts#L103)).
  - `createPublicOrder`: Mengembalikan `201` ([server/src/controllers/publicController.ts:478](file:///d:/Admin/adminsunbirojasa/server/src/controllers/publicController.ts#L478)).
  - `uploadDocument`: Mengembalikan `201` ([server/src/controllers/documentController.ts:190](file:///d:/Admin/adminsunbirojasa/server/src/controllers/documentController.ts#L190)).
  - `createUser`, `createEmployee`, `createPaymentMethod`, `createReimbursement`, `addKasKantor`, `addPengeluaran`: Semuanya mengembalikan `201`!
  - `createService` tidak ada karena rutenya tidak pernah didaftarkan di `serviceRoutes.ts`.
- **Dampak Teknis:** Backend SUN89 sebenarnya **sangat konsisten menggunakan 201 Created** untuk entitas baru. Klaim Phase 1A bahwa banyak controller create mengembalikan `200 OK` tidak terbukti.
- **Rekomendasi Perbaikan:** Cukup memastikan consumer frontend mentoleransi status 200/201 saat order dibuat secara berulang (idempotensi).

### API-04: Validasi Request pada Service Update dan Estimation Template PUT
- **Status Validasi:** **PARTIALLY CONFIRMED**
- **Bukti Implementasi:** Pada [server/src/routes/serviceRoutes.ts:17-22](file:///d:/Admin/adminsunbirojasa/server/src/routes/serviceRoutes.ts#L17-L22) dan [server/src/routes/estimationRoutes.ts:23-28](file:///d:/Admin/adminsunbirojasa/server/src/routes/estimationRoutes.ts#L23-L28), rute tidak dipasangi middleware validasi Express. Namun, validasi ditegakkan secara imperatif di dalam service layer ([serviceService.ts:47-54](file:///d:/Admin/adminsunbirojasa/server/src/services/serviceService.ts#L47-L54) dan [estimationService.ts:89-102](file:///d:/Admin/adminsunbirojasa/server/src/services/estimationService.ts#L89-L102)).
- **Dampak Teknis:** Properti payload arbitrer yang tidak dikenal tidak ditolak di layer routing (*loose validation*), meskipun integritas bisnis terlindungi di service layer.
- **Rekomendasi Perbaikan:** Menambahkan middleware skema validator (Zod/Joi) pada rute PUT master data di backend.

### API-05: Perbedaan Dialek Enum Status Antar Domain
- **Status Validasi:** **CONFIRMED**
- **Bukti Implementasi:**
  - Order: `ORDER_DITERIMA`, `PROSES_SAMSAT`, `SELESAI`, `DIBATALKAN` (Bahasa Indonesia).
  - Invoice: `UNPAID`, `PARTIAL`, `PAID`, `VOID` (Bahasa Inggris).
  - Payment: `MENUNGGU_VERIFIKASI`, `VERIFIED`, `REJECTED` (Campuran).
- **Dampak Teknis:** Frontend tidak dapat menggunakan satu enum translator universal; harus memetakan status berdasarkan domain entitas masing-masing.
- **Rekomendasi Perbaikan:** Penyesuaian adapter di sisi frontend pada Phase 1B.

### API-06: Format Timestamp UTC ISO vs SQLite Localtime
- **Status Validasi:** **CONFIRMED**
- **Bukti Implementasi:** Repository menyimpan default timestamp dengan fungsi SQLite `datetime('now')` yang menghasilkan format string `"YYYY-MM-DD HH:MM:SS"`, sedangkan respons controller menghasilkan string ISO 8601 UTC `"YYYY-MM-DDTHH:MM:SS.sssZ"`.
- **Dampak Teknis:** Komponen frontend yang melakukan `new Date(row.updated_at)` tanpa timezone handler dapat mengalami pergeseran waktu 7 jam (WIB).
- **Rekomendasi Perbaikan:** Normalisasi parser tanggal di sisi frontend dan standarisasi penyimpanan ISO UTC di backend pada fase remediasi.

---

## 10. CORRECTED FINDINGS AND UNRESOLVED AMBIGUITIES

### Temuan Baru Tambahan (Fakta Terverifikasi)
1. **`FINDING-VAL-01` (Inkonsistensi Nomenklatur Parameter Endpoint Messenger):**
   Endpoint `GET /api/messenger/tasks/:orderNo` menggunakan parameter `:orderNo`, sedangkan rute sub-task order `POST /api/orders/:orderNo/tasks/:taskType/accept` menggunakan `:taskType`. Tidak ada endpoint backend yang menggunakan `:taskId`. Frontend harus mengonsumsi `:orderNo` dan `:taskType`.
2. **`FINDING-VAL-02` (Rute POST dan PUT Kembar pada Tarif Samsat):**
   `POST /api/pricing/samsat-tariffs` dan `PUT /api/pricing/samsat-tariffs` meregistrasikan handler yang sama persis ([server/src/routes/pricingRoutes.ts:73-84](file:///d:/Admin/adminsunbirojasa/server/src/routes/pricingRoutes.ts#L73-L84)). Keduanya memanggil `updateSamsatOperationalTariffs`.

### Ambiguity yang Belum Dapat Dipastikan Tanpa Keputusan Manusia
- **Kebijakan Otorisasi Penghapusan Audit Log:** Apakah penghapusan riwayat audit harus mutlak dibatasi untuk `administrator` (Superadmin), ataukah `svp` (Supervisor) dan `admin` memang sengaja diizinkan melakukan penghapusan via rute `/api/audit`? Keputusan desain ini memerlukan konfirmasi pemangku kepentingan saat fase remediasi.

---

## 11. DAMPAK TERHADAP RENCANA PHASE 1B

Hasil addendum validasi ini mengubah baseline acuan untuk **Phase 1B (Frontend Contract Consumption Audit)** sebagai berikut:
1. **Pemeriksaan Consumer Messenger:**
   Audit frontend pada file `src/app/data/orderStore.ts` dan komponen kurir harus memverifikasi pemanggilan ke `/api/messenger/*` (bukan `/api/messengers/*`) dan parameter `:orderNo` / `:taskType`.
2. **Pemeriksaan Consumer Dokumen:**
   Audit frontend harus memastikan upload berkas menggunakan field `file` dengan parameter relasi opsional `orderNo` dan `invoiceId`, serta penggunaan `PATCH /api/documents/:id/link-order` untuk penautan susulan.
3. **Pemeriksaan Workflow State Machine:**
   Audit frontend harus mencocokkan status order terhadap **8 tahapan kanonikal** (`STAGES`), memastikan tidak ada komponen frontend yang mengharapkan 10 tahapan atau berasumsi bahwa pembayaran DP/Pelunasan adalah nomor tahapan workflow.
4. **Pemeriksaan Adapter Status & Tanggal:**
   Audit frontend harus memeriksa apakah `src/data/api/*` telah memiliki translator dialek status per domain dan parser tanggal tahan timezone.

---

## 12. FINAL ACCEPTANCE STATUS

> [!IMPORTANT]
> **STATUS KELAYAKAN BASELINE: DITERIMA DENGAN ADDENDUM (ACCEPTED WITH ADDENDUM)**  
> Dengan diterbitkannya laporan addendum forensik ini:
> - Seluruh ketidakkonsistenan angka route inventory telah direkonsiliasi secara transparan (159 Active Express Registrations / 143 Strict Functional Contracts / 139 Coarse Capability Contracts).
> - Arsitektur workflow telah terbukti secara definitif memiliki **8 Tahap Kanonikal** dengan aturan approval gate yang terverifikasi di kode sumber.
> - Kontrak upload dokumen telah terpetakan secara presisi tanpa ambiguitas.
> - Formula skor kelengkapan skema telah disajikan secara terukur dan defensibel (93.36% Weighted Index / 88.11% Strict Complete).
> - Seluruh temuan API-01 sampai API-06 telah diverifikasi berbasis bukti baris kode aktual.
> 
> **Rekomendasi Arsitektur:** Dokumentasi backend kini telah stabil, faktual, dan **aman untuk dijadikan acuan tunggal (*Source of Truth*) sebelum melanjutkan ke Phase 1B**.

---

## 13. FINAL RECONCILIATION CORRECTION

Bagian ini merupakan **Koreksi Rekonsiliasi Final** untuk menyelesaikan perbedaan matematis antara total rute, jumlah alias, dan jumlah kontrak fungsional, serta memverifikasi status rute penautan dokumen.

### 13.1 Rekonsiliasi Matematis Angka Endpoint

Pada audit sistem Express backend SUN89, terdapat dua tingkatan granularitas kontrak:

1. **Tingkat Kontrak Fungsional Ketat (Strict Functional Contracts = 143):**
   - Total Active Express Registrations: **159 rute**
   - Total Unique Method + Path: **159 kombinasi unik**
   - Dikurangi **16 True Alias & Mount Replicas** (rute sekunder yang memanggil handler identik dengan parameter/tujuan yang sama persis):
     $$159 - 16 = \mathbf{143\text{ Strict Functional Contracts}}$$
2. **Tingkat Kapabilitas Makro (Coarse Capability Contracts = 139):**
   - Diperoleh jika mengelompokkan **4 Operational Variant Routes** tambahan (rute yang memanggil handler sama dengan variasi query param atau pasangan aksi directional/bulk):
     $$143 - 4 = \mathbf{139\text{ Coarse Capability Contracts}}\quad (159 - 20 = 139)$$

Kedua angka ini konsisten secara matematis:
- Jika dihitung pada tingkat URL contract & handler independen: **143**.
- Jika dihitung pada tingkat kapabilitas fitur bisnis (menggabungkan varian parameter & pasangan transfer): **139**.

---

### 13.2 Identifikasi & Pemetaan 20 Rute Non-Kanonikal

Berikut adalah daftar lengkap 20 rute yang tidak dihitung sebagai kontrak independen pada level kapabilitas makro (terdiri dari 16 True Alias dan 4 Operational Variants):

| No | Rute Sekunder / Varian | Method & Path | Kategori Relasi | Kontrak Kanonikal Tujuan | Handler Aktual | Bukti Sumber Kode |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Health Live Alias | `GET /api/health/live` | True Alias (Handler Identik) | `GET /api/health` | `livenessHandler` | [server/src/app.ts:87-88](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L87-L88) |
| **2** | Order Archive Alias | `GET /api/orders/archive` | True Alias (Path Spelling) | `GET /api/orders/archived` | `getArchivedOrders` | [server/src/routes/orderRoutes.ts:52-53](file:///d:/Admin/adminsunbirojasa/server/src/routes/orderRoutes.ts#L52-L53) |
| **3** | Order Clear-All Alias | `DELETE /api/orders/archived/clear-all` | True Alias (Path Spelling) | `DELETE /api/orders/archive/clear-all` | `clearArchivedOrders` | [server/src/routes/orderRoutes.ts:92-99](file:///d:/Admin/adminsunbirojasa/server/src/routes/orderRoutes.ts#L92-L99) |
| **4** | Pricing Tariffs Verb Alias | `POST /api/pricing/samsat-tariffs` | True Alias (Verb Semantics) | `PUT /api/pricing/samsat-tariffs` | `updateSamsatOperationalTariffs` | [server/src/routes/pricingRoutes.ts:73-84](file:///d:/Admin/adminsunbirojasa/server/src/routes/pricingRoutes.ts#L73-L84) |
| **5** | Finance PnL Alias | `GET /api/finance/pnl` | True Alias (Naming Alias) | `GET /api/finance/laba-rugi` | `getLabaRugiSummary` | [server/src/routes/financeRoutes.ts:49-60](file:///d:/Admin/adminsunbirojasa/server/src/routes/financeRoutes.ts#L49-L60) |
| **6** | Audit Clear Verb Alias | `POST /api/audit-logs/clear` | True Alias (Verb Alias) | `DELETE /api/audit-logs` | `clearAuditLogs` | [server/src/routes/auditRoutes.ts:31-48](file:///d:/Admin/adminsunbirojasa/server/src/routes/auditRoutes.ts#L31-L48) |
| **7** | Audit Mount Replica (Get) | `GET /api/audit` | Mount Replica (`/api/audit` mount) | `GET /api/audit-logs` | `getAuditLogs` | [server/src/app.ts:144-145](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L144-L145) |
| **8** | Audit Mount Replica (Post) | `POST /api/audit` | Mount Replica (`/api/audit` mount) | `POST /api/audit-logs` | `recordAuditLog` | [server/src/app.ts:144-145](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L144-L145) |
| **9** | Audit Mount Replica (Delete)| `DELETE /api/audit` | Mount Replica (Divergent Role) | `DELETE /api/audit-logs` | `clearAuditLogs` | [server/src/routes/auditRoutes.ts:31-41](file:///d:/Admin/adminsunbirojasa/server/src/routes/auditRoutes.ts#L31-L41) |
| **10**| Audit Mount Replica (Clear) | `POST /api/audit/clear` | Mount Replica (`/api/audit` mount) | `POST /api/audit-logs/clear` | `clearAuditLogs` | [server/src/app.ts:144-145](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L144-L145) |
| **11**| Public Services Replica | `GET /api/public/services` | Mount Replica (`/api/public` mount) | `GET /api/v1/public/services` | `getPublicServices` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **12**| Public Samsat Replica | `GET /api/public/samsat` | Mount Replica (`/api/public` mount) | `GET /api/v1/public/samsat` | `getPublicSamsatOffices` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **13**| Public Pricing Replica | `GET /api/public/pricing` | Mount Replica (`/api/public` mount) | `GET /api/v1/public/pricing` | `getPublicPricingEstimate` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **14**| Public Orders Replica | `POST /api/public/orders` | Mount Replica (`/api/public` mount) | `POST /api/v1/public/orders` | `createPublicOrder` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **15**| Public Tracking Nopol | `GET /api/public/orders/tracking` | Mount Replica (`/api/public` mount) | `GET /api/v1/public/orders/tracking` | `trackOrderByNopol` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **16**| Public Tracking Detail | `GET /api/public/orders/:orderNo/tracking` | Mount Replica (`/api/public` mount) | `GET /api/v1/public/orders/:orderNo/tracking` | `getPublicOrderDetailTracking` | [server/src/app.ts:158-159](file:///d:/Admin/adminsunbirojasa/server/src/app.ts#L158-L159) |
| **17**| Samsat Tariff Query-Delete | `DELETE /api/pricing/samsat-tariffs` | Operational Variant (Query Param) | `DELETE /api/pricing/samsat-tariffs/:id` | `deleteSamsatOperationalTariff` | [server/src/routes/pricingRoutes.ts:85-96](file:///d:/Admin/adminsunbirojasa/server/src/routes/pricingRoutes.ts#L85-L96) |
| **18**| Reverse Internal Transfer | `POST /api/finance/transfer/office-to-messenger` | Operational Variant (Directional) | `POST /api/finance/transfer/messenger-to-office` | `transferOfficeToMessenger` | [server/src/routes/financeRoutes.ts:202-215](file:///d:/Admin/adminsunbirojasa/server/src/routes/financeRoutes.ts#L202-L215) |
| **19**| Bulk Estimation Reset | `POST /api/estimation/reset-all` | Operational Variant (Bulk Action) | `POST /api/estimation/templates/:id/reset` | `resetAllTemplates` | [server/src/routes/estimationRoutes.ts:30-42](file:///d:/Admin/adminsunbirojasa/server/src/routes/estimationRoutes.ts#L30-L42) |
| **20**| Archive Order Deletion | `DELETE /api/orders/:orderNo/archive` | Operational Variant (State Action) | `POST /api/orders/:orderNo/archive` | `deleteArchivedOrder` | [server/src/routes/orderRoutes.ts:105-117](file:///d:/Admin/adminsunbirojasa/server/src/routes/orderRoutes.ts#L105-L117) |

### 13.3 Penjelasan Mengapa 4 Rute Tambahan Bukan "True Alias"

Empat rute (No. 17 sampai No. 20) tidak digolongkan sebagai *True Alias* murni (16 alias) karena:
1. **`DELETE /api/pricing/samsat-tariffs` (No. 17):** Meskipun memanggil handler yang sama (`deleteSamsatOperationalTariff`), rute ini membaca `req.query` (`samsatId` dan `pricingItemId`), sedangkan rute kanonikal `DELETE /:id` membaca `req.params.id`. Keduanya adalah **varian routing input**.
2. **`POST /api/finance/transfer/office-to-messenger` (No. 18):** Merupakan aksi berlawanan arah dari `messenger-to-office` (Kantor $\to$ Kurir vs Kurir $\to$ Kantor) dengan handler berbeda (`transferOfficeToMessenger` vs `transferMessengerToOffice`). Dalam level kapabilitas umumeduanya adalah fitur "Internal Cash Transfer", namun dalam kontrak REST keduanya adalah **endpoint terpisah**.
3. **`POST /api/estimation/reset-all` (No. 19):** Memanggil handler `resetAllTemplates` yang me-reset seluruh template sekaligus, berbeda target dari `templates/:id/reset` yang me-reset single record. Keduanya adalah **varian bulk vs single**.
4. **`DELETE /api/orders/:orderNo/archive` (No. 20):** Memanggil handler `deleteArchivedOrder` untuk menghapus order berstatus arsip secara permanen, sedangkan `POST /:orderNo/archive` memanggil `archiveOrder` untuk memindahkan order aktif ke arsip. Keduanya adalah **dua operasi berlawanan pada domain arsip order**.

**Kesimpulan:**
- Pada perhitungan **Strict Functional Contracts**, No. 17-20 adalah kontrak independen valid $\to$ **143 Kontrak Fungsional**.
- Pada pengelompokan **Coarse Capability**, No. 17-20 digabung ke kapabilitas induknya $\to$ **139 Kontrak Kapabilitas**.

---

### 13.4 Verifikasi Faktual Rute Penautan Dokumen

Berdasarkan pemeriksaan menyeluruh pada kode sumber backend:
- `PUT /api/documents/:id/order`: **TIDAK TERDAFTAR (DOES NOT EXIST)** pada router backend manapun. Penyebutan rute ini pada laporan awal Phase 1A adalah kekeliruan pencatatan dokumentasi.
- `PATCH /api/documents/:id/link-order`: **TERDAFTAR, AKTIF, DAN MERUPAKAN IMPLEMENTASI TUNGGAL**.

**Spesifikasi Faktual Penautan Dokumen:**
- **HTTP Method:** `PATCH`
- **Absolute URL Path:** `/api/documents/:id/link-order`
- **Handler Controller:** `linkDocumentToOrder` di [server/src/controllers/documentController.ts:351-375](file:///d:/Admin/adminsunbirojasa/server/src/controllers/documentController.ts#L351-L375)
- **Middleware Rute:** `requireAuth`
- **Request Body:**
  ```json
  {
    "orderNo": "ORD-20261109-0001"
  }
  ```
  *(Catatan: Controller juga menerima alias `"order_no"` melalui utilitas `normalizeDocumentUploadPayload` di [aliasNormalizer.ts:667-683](file:///d:/Admin/adminsunbirojasa/server/src/utils/aliasNormalizer.ts#L667-L683)).*
- **Otorisasi / Permission:** Memerlukan token Bearer valid (`requireAuth`). Verifikasi kepemilikan dan relasi order ditegakkan di dalam `documentService.linkOrder`.
- **Nomor Baris Sumber:** [server/src/routes/documentRoutes.ts:67](file:///d:/Admin/adminsunbirojasa/server/src/routes/documentRoutes.ts#L67):
  ```typescript
  documentRouter.patch("/:id/link-order", requireAuth, linkDocumentToOrder);
  ```

---

### 13.5 Konfirmasi Integritas Read-Only

Audit koreksi addendum ini dilaksanakan dengan kepatuhan penuh terhadap prinsip **Read-Only**:
- Database SQLite `server/data/database.sqlite` tetap terlindungi tanpa modifikasi (SHA-256: `D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C`).
- Berkas penyimpanan upload `server/uploads/` tidak tersentuh (51 berkas aktif, 1.525.984 bytes).
- Tidak ada source code, konfigurasi, dependency, atau data operasional yang diubah.

---

*Laporan validasi ini disusun berdasarkan fakta kode aktual SUN89 Backend pada tanggal 9 November 2026.*
