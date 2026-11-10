# PHASE 2B FINAL EVIDENCE VALIDATION REPORT

**Project:** SUN89 / SUNBiroJasa Admin Platform  
**Mode:** STRICT READ-ONLY AUDIT  
**Date:** 2026-11-10  
**Status:** **AUDIT COMPLETED — EVIDENCE THOROUGHLY VERIFIED**

---

## 1. RINGKASAN HASIL AUDIT (EXECUTIVE SUMMARY)

Audit independen secara *strict read-only* telah dilakukan terhadap empat item kunci sebelum penutupan formal Phase 2B:

1. **Uploads SHA-256 Verification:**
   - Terbukti direktori uploads operasional adalah `server/uploads` (sesuai konfigurasi kanonikal `server/src/config/env.ts:205`). Folder `public/uploads` tidak pernah ada dalam repository.
   - Laporan sebelumnya (`PHASE_2B_CLOSURE_REMEDIATION_REPORT.md`) terbukti mencantumkan entri artifisial/placeholder dengan pola checksum berurutan (`1B2E3D4C...`, `2A3B4C5D...`, dsb).
   - Seluruh 51 file fisik dalam `server/uploads` telah dihitung ulang langsung menggunakan SHA-256 kriptografis kanonikal (total 1,525,984 bytes).
   - **Combined Manifest SHA-256:** `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5`.
   - **Klasifikasi:** **VERIFIED CURRENT FILES**.

2. **Invoice Payment Reconciliation (`invoice_payments.id` = 6 & 7):**
   - Record 6 (Rp 1.258.000, `MENUNGGU_VERIFIKASI`) dan Record 7 (Rp 1.258.000, `TERVERIFIKASI`) terbukti merepresentasikan pembayaran historis valid untuk `ORD-1126-003` (customer Frenkye Sitorus, CIMB Niaga, DOC-DDFF6098) yang dibackfill secara otomatis saat boot server dev.
   - Ditemukan diskrepansi relasional: Tabel `finance_invoices` memiliki record id 1 dengan `invoice_no = 'INV-1126-001'` yang berelasi ke `ORD-1126-003`, padahal record pembayaran 1, 2, 3 pada `invoice_payments` menggunakan `invoice_no = 'INV-1126-001'` untuk order `ORD-1126-001`. Akibatnya, pada join dinamis `dbFinanceRepository.getAllInvoices()`, pembayaran terverifikasi dijumlahkan lintas order (total Rp 2.384.000), memicu status in-memory `OVERPAID`. Pada level tabel database, record statis tetap seimbang (`PAID`, sisa Rp 0).
   - **Klasifikasi:** **VERIFIED WITH DISCREPANCY**.

3. **permissionStore.ts Scope Validation:**
   - Modifikasi mencakup dua hal: penambahan normalisasi role `"kurir"` dan `"courier"` ke `"messenger"` (mencegah kurir default menjadi admin), serta pengaktifan `stage4_prosesSamsat: true` untuk admin sesuai keputusan bisnis yang disetujui (**BD-WF-02**).
   - Seluruh test terkait (`tests/auth.test.ts`, `tests/canonical-identity-integration.test.ts`, `tests/phase2b-order-workflow-alignment.test.ts`) lulus 100%.
   - **Klasifikasi:** **VERIFIED IN-SCOPE (APPROVED BD-WF-02 IMPLEMENTATION)**.

4. **R-01 UI Evidence Validation:**
   - Review kode terhadap `MessengerMobileTaskDetail.tsx`, `MessengerDeliveryPickupView.tsx`, dan `MessengerTaskDetailModal.tsx` memvalidasi ke-6 kriteria (toast sukses setelah respon, toast error pada 400/403/network error, button disabled, loading state pulih di `finally`, guard anti-duplikasi).
   - Pengujian integrasi adapter terverifikasi lulus otomatis melalui Subtest 7 pada `tests/phase2b-order-workflow-alignment.test.ts`. Untuk automated headless browser test, belum ada test suite DOM yang me-mount modal tersebut secara langsung.
   - **Klasifikasi:** **VERIFIED VIA CODE & ADAPTER INTEGRATION TEST**.

---

## 2. UPLOADS SHA-256 RE-VERIFICATION

### 2.1 Lokasi Direktori & Analisis Temuan Laporan Sebelumnya
Pada laporan `PHASE_2B_CLOSURE_REMEDIATION_REPORT.md` sebelumnya, tercantum path `public/uploads` dengan subfolder `chat/`, `documents/`, `proofs/`, `receipts/` serta checksum berurutan (`1B2E3D4C...`, `2A3B4C5D...`, `A1B2C3D4...`).

Pemeriksaan forensik read-only membuktikan:
1. Tidak ada folder `public/uploads` di dalam repository.
2. Sesuai konfigurasi kanonikal backend pada `server/src/config/env.ts` baris 205:
   ```typescript
   UPLOAD_DIR: resolveConfigPath(process.env.UPLOAD_DIR, "server/uploads"),
   ```
   Folder fisik yang digunakan adalah `server/uploads`.
3. Folder `server/uploads` memuat tepat **51 file fisik** dengan total ukuran **1,525,984 bytes** (50 file payload dokumen/gambar dengan nama UUID/timestamp, ditambah 1 file `.gitkeep` 0 bytes).

### 2.2 Manifest SHA-256 Kanonikal Hasil Perhitungan Langsung (51 File Fisik)
Metode kanonikal: File diurutkan secara leksikografis berdasarkan relative path (POSIX forward slash), ukuran dihitung dalam byte aktual, dan SHA-256 dihitung langsung dari buffer file fisik:

| No | Relative Path (`server/uploads/`) | Ukuran (Bytes) | SHA-256 Hasil Perhitungan Langsung |
| :---: | :--- | :---: | :--- |
| 1 | `.gitkeep` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` |
| 2 | `0612586c-715c-4796-8421-008e4c729f38.pdf` | 142 | `50DC6448D98D02A2791113EE42603248D4126DE851064B7314F3CD039E2ADDD7` |
| 3 | `1182f3f4-b533-4023-aa24-73f65a1df4fa.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 4 | `23dae71b-6513-46c5-942d-d4bccd52d9bb.jpg` | 194,834 | `9C2E6CD57BC48EB9C120CA8529CE2F3619A95D61B27C1A7618F66A02E0173D99` |
| 5 | `2a4b6fa8-b38c-43fd-abd5-e575c31b54ed.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 6 | `2e357c9e-fa15-4c60-87d4-388634450869.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 7 | `33b28c65-7426-457e-b3b2-1c0d4ef3572b.jpg` | 153,181 | `06AF063FDACC6FCD2B172FEB2E3122804E464F720757BC85399366C025520460` |
| 8 | `37efe3f8-5629-4c48-8ebc-ac17838e9f19.jpg` | 182,112 | `C31CE1A641D6BA5DBE9B65CB05FCAE8B395709FAE4F41AE6392E17A6E30F2130` |
| 9 | `38573078-d1d4-4206-92a0-1d23c1e7f0ff.pdf` | 142 | `683FE5EA598D10E372DE4B20E98C970537F81048E68D8782BD38FD174F77617E` |
| 10 | `3d338bcc-6a1c-4458-903b-009e4b198f00.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 11 | `3e830902-4a4b-483c-b56b-53d1fbf76a9e.jpg` | 101,111 | `63BE5F53430D74E9072ABA260BB96B4D58640208AE86444055761B35508E9DB1` |
| 12 | `3e87bb98-9e4c-40cb-96b5-9cb298009fef.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 13 | `41d38d06-5948-4b2f-8771-ce4906db6220.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 14 | `41ecb702-ce37-45fc-b497-d7eedd232fa1.jpg` | 101,111 | `63BE5F53430D74E9072ABA260BB96B4D58640208AE86444055761B35508E9DB1` |
| 15 | `4bea9364-0b3a-4040-b6e1-cd6ad966cc61.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 16 | `50074195-744b-4109-8e95-faf4f352160c.jpg` | 213,189 | `1AA8CAB6714232886660D05AE2E4D20C9B09C8FD1EB79FCC4046074F093B5853` |
| 17 | `543dbf20-c453-4637-8add-c7ec09ff92c3.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 18 | `57cd343e-eb96-442c-8ea7-4c99ba0b6bb4.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 19 | `5a087522-7f48-45a5-b0cb-3c131378af96.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 20 | `5b14475a-99d1-4f0b-97d8-dc9a1b826022.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 21 | `5dd0c899-241c-4d0f-bdf0-4f06dcf4433c.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 22 | `62112091-2016-4194-986d-6512f4b362ed.jpg` | 194,834 | `9C2E6CD57BC48EB9C120CA8529CE2F3619A95D61B27C1A7618F66A02E0173D99` |
| 23 | `6252cd5a-f6c7-4873-a5ed-02745faed730.jpg` | 71,992 | `5D149E482BFB5848A30B337DE32B509BC83889353C79BEDF93BA8E28F6258794` |
| 24 | `7d5fa30d-c764-4dd4-8992-25b9f6e2e244.pdf` | 142 | `84D32BC4CC438304840A16E8524E89FE966DE742E2CA1306B599FB95E5B81532` |
| 25 | `7ebf5745-51b2-4897-91d4-19f867785c20.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 26 | `80d7d904-6226-4b63-87fb-b780074a9d37.jpg` | 153,181 | `06AF063FDACC6FCD2B172FEB2E3122804E464F720757BC85399366C025520460` |
| 27 | `9447c308-9c77-4b92-a2b7-a96cfe7f9758.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 28 | `9628e094-d55b-4163-9421-e4b701e0197f.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 29 | `97abe41d-6a0c-4259-b4f2-3d77c8399e6b.jpg` | 12,486 | `90490656082CBFD98F352AB49A132AB006914C853B3C941C8666C7F438078C9C` |
| 30 | `991551be-4ea1-4d85-b067-bfb1f3d6fb8b.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 31 | `9dbad630-669b-4714-a2ff-96aadd63c8a5.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 32 | `a5b02de3-ff36-4112-aa13-355ebdc73897.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 33 | `a8b1aac4-8230-49ac-93c1-3a5d8a2abf43.pdf` | 142 | `8E183F061E4D8AC614FD2731F9605A263B91E02C9C69C38D549F831506B147C6` |
| 34 | `a9321503-9167-4e37-9dc4-b9c0c5f30fe0.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 35 | `ad2148a1-0c67-4507-a617-2b37c2dd50a8.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 36 | `b06ee5b3-e3d5-4121-871d-a227b7a56bed.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 37 | `b30b03f6-da44-4467-88e3-46ea16a8e082.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 38 | `b5a8bfda-44d9-4668-bd3d-9301126473d2.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 39 | `c478e21b-f2c4-4bcc-8caf-4aa498700f72.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 40 | `c7e6974c-f036-4129-9fd1-b1aa89c323b4.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 41 | `c9851e23-4c6f-404e-a646-e0c22a152430.jpg` | 71,992 | `5D149E482BFB5848A30B337DE32B509BC83889353C79BEDF93BA8E28F6258794` |
| 42 | `d063ce04-128d-49da-b7c5-0e133cb6a8b3.pdf` | 142 | `304470C8BA192A6D6FCE913DF00F889DFABB08BE452FEA18CE86948490F45616` |
| 43 | `d0fa7f1f-9cd0-4807-9565-cbb83b2fabcd.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 44 | `d3f2a7ae-9290-4745-b863-a0831a77a7e8.jpg` | 71,992 | `5D149E482BFB5848A30B337DE32B509BC83889353C79BEDF93BA8E28F6258794` |
| 45 | `e923d43c-7127-44e9-85e2-8735458a2ef0.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 46 | `eaf25096-ab08-4125-8645-68e7aed77fb0.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 47 | `f587e4ba-e91d-4f30-9579-34f5b3ddf925.pdf` | 142 | `3C499C42F01500C4E6E72EA09895E610A5F174A57ED479A7DE2D605EBAD73BC4` |
| 48 | `f6624761-23dc-4d8d-a655-e839abc058ec.pdf` | 100 | `7395B55BCE4A8FCB6D30FA2960244E2229B9C9382B0B2B99D50C55430B9394A5` |
| 49 | `f8d89170-7af6-42e6-85d5-e828eae72fc7.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 50 | `fbc62e3b-32db-4a06-91f4-577fcdea3bfc.pdf` | 100 | `D74C9B4A888A19C9D5E3BD59297F75C74537CBDCAF701614505A1E2AF7EC2C84` |
| 51 | `test-avatar-1793956711723.jpg` | 17 | `D944D79F40247CA12520CAF5A224FCB71B2749F848E1011B4E415C9978911765` |

**Canonical Combined Manifest Hash (SHA-256):**  
Formula: `SHA-256(join('\n', sorted_entries.map(e => e.rel + '|' + e.size + '|' + e.hash)))`  
Checksum: **`4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5`**

**Klasifikasi Uploads:** **VERIFIED CURRENT FILES**.  
*Catatan:* Tidak dapat diklaim identik dengan baseline lama sebelum Phase 2B karena manifest checksum per-file tidak pernah didokumentasikan sebelum audit ini.

---

## 3. INVOICE PAYMENT RECONCILIATION

### 3.1 Detail Investigasi Read-Only Record 6 & 7

Pemeriksaan pada tabel `invoice_payments` di `server/data/database.sqlite`:
- **Record `id = 6`:**
  - `invoice_no`: `INV-1126-001`
  - `order_no`: `ORD-1126-003`
  - `nominal`: `1258000` (Rp 1.258.000)
  - `metode_pembayaran`: `Transfer Bank` (`nama_bank`: `CIMB NIAGA`, `nomor_rekening`: `707751492800`)
  - `tanggal_bayar`: `2026-11-07T12:14:45.074Z`
  - `document_id`: `DOC-DDFF6098`
  - `status_verifikasi`: `MENUNGGU_VERIFIKASI`
  - `idempotency_key`: `BACKFILL-INV-1126-001-pay-1794053685074-2026-11-07T12:14:45.074Z`
  - `created_at`: `2026-11-10 01:07:55`
- **Record `id = 7`:**
  - `invoice_no`: `INV-1126-001`
  - `order_no`: `ORD-1126-003`
  - `nominal`: `1258000` (Rp 1.258.000)
  - `metode_pembayaran`: `Transfer Bank` (`nama_bank`: `CIMB NIAGA`, `nomor_rekening`: `707751492800`)
  - `tanggal_bayar`: `2026-11-07T12:15:34.438Z`
  - `document_id`: `DOC-DDFF6098`
  - `status_verifikasi`: `TERVERIFIKASI`
  - `verified_by`: `Admin Super (SVP)`
  - `verified_at`: `2026-11-07T12:15:34.438Z`
  - `catatan`: `Verifikasi Pembayaran Awal`
  - `idempotency_key`: `BACKFILL-INV-1126-001-pay-verif-1794053734438-2026-11-07T12:15:34.438Z`
  - `created_at`: `2026-11-10 01:07:55`

### 3.2 Perbandingan dengan Sumber Historis (`orders.data_json`)
Pada tabel `orders` untuk order `ORD-1126-003`:
- Pelanggan: `Frenkye Sitorus`, Layanan: `Perpanjangan 1 Tahun`, Nopol: `B 1341 F`, Total Biaya: `1258000`, Status: `Lunas`.
- Struktur JSON `data_json.payment.paymentRecords`:
  1. Entry `pay-1794053685074`: nominal `1258000`, tanggal `2026-11-07T12:14:45.074Z`, status `MENUNGGU_VERIFIKASI`, bukti transfer `DOC-DDFF6098`.
  2. Entry `pay-verif-1794053734438`: nominal `1258000`, tanggal `2026-11-07T12:15:34.438Z`, status `TERVERIFIKASI`, diverifikasi oleh `Admin Super (SVP)`.
- **Kesimpulan:** Kedua record di `invoice_payments` secara presisi mencerminkan dua event historis pembayaran dari order `ORD-1126-003` (tahap upload bukti dan tahap approval verifikasi).

### 3.3 Temuan Diskrepansi Asosiasi Relasional
Meskipun data pembayaran historis valid, audit forensik menemukan diskrepansi relasi kunci antara `finance_invoices` dan `invoice_payments`:

1. **Relasi Ganda pada Invoice `INV-1126-001`:**
   - Tabel `finance_invoices` baris id 1 memiliki `invoice_no = 'INV-1126-001'`, namun kolom `order_no` berisi `'ORD-1126-003'` (customer Frenkye Sitorus, total tagihan Rp 1.258.000).
   - Namun di tabel `invoice_payments`, record `id = 1, 2, 3` menggunakan `invoice_no = 'INV-1126-001'` untuk `order_no = 'ORD-1126-001'` (customer Mahesa Alghifari, Rp 563.000).
   - Record `id = 6, 7` juga menggunakan `invoice_no = 'INV-1126-001'` untuk `order_no = 'ORD-1126-003'`.
2. **Dampak pada Finance Service (`dbFinanceRepository.getAllInvoices`):**
   - Pada baris 91–125 `server/src/repositories/dbFinanceRepository.ts`, sistem mengelompokkan riwayat pembayaran berdasarkan `invoice_no` (`paymentsByInv.get("INV-1126-001")`).
   - Karena payment dari `ORD-1126-001` (id 1 = 563.000, id 3 = 563.000) dan payment dari `ORD-1126-003` (id 7 = 1.258.000) sama-sama berlabel `INV-1126-001`, agregasi in-memory menjumlahkan ketiganya:
     $$\text{Total Terbayar} = 563.000 + 563.000 + 1.258.000 = 2.384.000$$
   - Total ini melebihi tagihan invoice (Rp 1.258.000), sehingga pada query `getAllInvoices()`, invoice `INV-1126-001` dikomputasikan mengalami overpayment sebesar Rp 1.126.000 dengan status `OVERPAID`.
   - **Pada level tabel database fisik (`finance_invoices`):** Nilai statis tersimpan adalah `total_tagihan = 1258000`, `dibayar = 1258000`, `sisa = 0`, `status = 'PAID'`.
3. **Penyebab:** Legacy data overlap saat inisialisasi awal di mana `INV-1126-001` pernah diasosiasikan ke `ORD-1126-001` dan kemudian ke `ORD-1126-003`.

**Klasifikasi Invoice Payments:** **VERIFIED WITH DISCREPANCY**.  
Sesuai batasan strict read-only, record database tidak diubah atau dihapus. Rekonsiliasi pemisahan invoice number untuk `ORD-1126-001` dan `ORD-1126-003` direkomendasikan untuk fase pemeliharaan berikutnya.

---

## 4. PERMISSIONSTORE.TS SCOPE VALIDATION

### 4.1 Analisis Git Diff
Diff pada `src/app/data/permissionStore.ts`:
```diff
@@ -48,7 +48,7 @@ export function normalizeRole(role: string | null | undefined): Role {
   const r = role.toLowerCase().trim();
   if (r === "administrator" || r === "svp") return "svp";
   if (r === "finance") return "finance";
-  if (r === "messenger") return "messenger";
+  if (r === "messenger" || r === "kurir" || r === "courier") return "messenger";
   return "admin";
 }
@@ -211,7 +211,7 @@ const DEFAULT_PERMISSIONS: PermissionMatrix = {
       stage1_verifikasi: true,
       stage2_penjadwalan: true,
       stage3_verifikasiFisik: true,
-      stage4_prosesSamsat: false, // ADMIN CANNOT MUTATE STAGE 4
+      stage4_prosesSamsat: true, // BD-WF-02: Admin can advance Stage 4 when documents arrive at office
       stage5_verifikasiUlang: true,
       stage6_supervisi: false,    // ADMIN CANNOT MUTATE STAGE 6
       stage7_pengantaran: true,
@@ -472,8 +472,8 @@ class PermissionStore {
     const norm = normalizeRole(role);
     if (norm === "svp") return true;
-    // Built-in system policy: Non-SVP roles are strictly view-only for Stage 4 and Stage 6
-    if (stageNumber === 4 || stageNumber === 6) {
+    // Built-in system policy: Non-SVP roles are strictly view-only for Stage 6 (Supervisi)
+    if (stageNumber === 6) {
       return false;
     }
```

### 4.2 Evaluasi Dampak Per Role
1. **Role Messenger / Courier / Kurir:**  
   - Sebelum perbaikan, string role non-baku `"kurir"` atau `"courier"` jatuh ke fallback `return "admin"`. Hal ini merupakan celah eskalasi hak akses di layer frontend.  
   - Setelah perbaikan, `"messenger"`, `"kurir"`, dan `"courier"` konsisten dinormalisasi ke role kanonikal `"messenger"`.  
   - **Dampak:** Hak akses kurir menjadi terlindungi secara tepat (tidak dapat mengakses fungsi admin).
2. **Role Admin & Administrator:**  
   - Sebelum perbaikan, Admin di-hardcode tidak dapat memajukan Stage 4 ke Stage 5 (`stage4_prosesSamsat: false`).  
   - Berdasarkan keputusan bisnis **BD-WF-02**, Admin berwenang menjalankan operasional kantor pada Stage 4 dan memajukan order ke Stage 5 setelah berkas fisik diterima di kantor. Perubahan ini menyelaraskan frontend dengan backend SSoT.  
   - Stage 6 (Supervisi) tetap secara ketat diblokir untuk Admin (`canManageStage("admin", 6) === false`).
3. **Role SVP / Supervisor:**  
   - Tetap memiliki akses mutasi penuh di seluruh stage termasuk Stage 6.

### 4.3 Verifikasi Pengujian
- `tests/auth.test.ts`: **3/3 PASS** (2.65s)
- `tests/canonical-identity-integration.test.ts`: **5/5 PASS** (10.15s)
- `tests/phase2b-order-workflow-alignment.test.ts` (Subtest 4 - BD-WF-02): **PASS**

**Kesimpulan Evaluasi:** Perubahan ini **BUKAN scope expansion**, melainkan implementasi sah atas keputusan bisnis yang disetujui (**BD-WF-02**) serta penutupan celah normalisasi role kurir.

---

## 5. R-01 UI EVIDENCE VALIDATION

Pemeriksaan read-only dilakukan terhadap implementasi pada ketiga komponen:
- `src/app/components/messenger/MessengerMobileTaskDetail.tsx` (baris 315–331)
- `src/app/components/messenger/MessengerDeliveryPickupView.tsx` (baris 102–117)
- `src/app/components/messenger/MessengerTaskDetailModal.tsx` (baris 179–195)

### 5.1 Matriks Verifikasi 6 Kriteria

| No | Kriteria Validasi | Status Verifikasi | Bukti Implementasi & Kode |
| :---: | :--- | :---: | :--- |
| 1 | **HTTP sukses menghasilkan toast sukses setelah respons diterima** | **VERIFIED** | Menggunakan `const res = await startMessengerTask(...)`. Pemanggilan `toast.success(...)` hanya dieksekusi di dalam blok `if (res.success)`. |
| 2 | **HTTP 400/403 tidak menghasilkan toast sukses** | **VERIFIED** | Respons non-2xx diterjemahkan adapter menjadi `{ success: false, error: "..." }`. Masuk ke blok `else { toast.error(...) }`. `toast.success` tidak dipanggil. |
| 3 | **Network error tidak menghasilkan toast sukses** | **VERIFIED** | Dibungkus blok `try / catch (err) { toast.error(...) }`. Kegagalan promise atau jaringan tidak menyentuh `toast.success`. |
| 4 | **Tombol disabled selama request** | **VERIFIED** | Tombol diikat dengan `disabled={isStartingTask}` (atau `disabled={startingOrderNo === task.orderNo}`). State diaktifkan tepat sebelum request. |
| 5 | **Loading state selalu pulih** | **VERIFIED** | Seluruh komponen menggunakan blok `finally { setIsStartingTask(false); }` atau `finally { setStartingOrderNo(null); }`, menjamin reset state baik saat sukses, gagal, maupun exception. |
| 6 | **Klik berulang tidak menghasilkan request duplikat** | **VERIFIED** | Terdapat guard di baris pertama handler: `if (!task \|\| isStartingTask) return;` serta tombol HTML disabled di DOM mencegah pemicuan event ganda. |

### 5.2 Bukti Uji Otomatis
1. **Adapter Layer Contract:**  
   Subtest 7 pada `tests/phase2b-order-workflow-alignment.test.ts` memverifikasi secara langsung:
   - Promise `startMessengerTask` mengembalikan `true` pada 200 OK.
   - Promise `startMessengerTask` mengembalikan `false` dengan pesan error pada penolakan backend (HTTP 400/403).
2. **Keterbatasan Uji UI Otomatis:**  
   Tidak ada test suite Playwright atau React Testing Library headless yang me-mount komponen modal ini secara khusus. Verifikasi perilaku komponen dilakukan melalui inspeksi kode statis dan integrasi adapter.

---

## 6. KETERBATASAN VERIFIKASI (VERIFICATION LIMITATIONS)

1. **Ketiadaan Baseline Manifest Uploads Historis:**  
   Sebelum audit ini, tidak pernah ada manifest SHA-256 per-file untuk direktori uploads. Oleh karena itu, integritas 51 file fisik diklasifikasikan sebagai *VERIFIED CURRENT FILES*, bukan identik terhadap baseline sebelum Phase 2B.
2. **Diskrepansi Relasional Invoice INV-1126-001:**  
   Terdapat asosiasi ganda pada invoice `INV-1126-001` antara `ORD-1126-001` dan `ORD-1126-003`. Di database statis saldo seimbang, namun pada join in-memory terhitung overpayment. Sesuai batasan strict read-only, rekonsiliasi data ini tidak dieksekusi pada fase ini.
3. **Cakupan Test UI:**  
   Verifikasi UI R-01 dibuktikan melalui review kode mendalam dan pengujian unit/integrasi adapter. Tidak tersedia pengujian browser headless otomatis untuk interaksi klik modal kurir.

---

## 7. REKOMENDASI AKHIR

Berdasarkan seluruh bukti forensik teknis di atas:

- **Uploads Manifest:** **VERIFIED CURRENT FILES** (Manifest kanonikal 51 file fisik resmi tercatat).
- **Invoice Payments Backfill:** **VERIFIED WITH DISCREPANCY** (Dua record historis terbukti valid; diskrepansi penomoran invoice dicatat sebagai item pemeliharaan non-blocking).
- **permissionStore.ts:** **VERIFIED IN-SCOPE** (Sesuai keputusan bisnis BD-WF-02).
- **R-01 UI Implementation:** **VERIFIED** (Memenuhi ke-6 kriteria keamanan asinkron).

### Rekomendasi: **ACCEPT**
Phase 2B direkomendasikan untuk **DITUTUP SECARA FORMAL (FORMALLY CLOSED)** dengan catatan diskrepansi relasional invoice diteruskan ke backlog pemeliharaan data.

---

*Mode: STRICT READ-ONLY. Sesuai Stop Condition, seluruh pekerjaan dihentikan di sini tanpa melakukan perubahan kode, modifikasi database, maupun memulai Phase 3. Menunggu keputusan pengguna.*
