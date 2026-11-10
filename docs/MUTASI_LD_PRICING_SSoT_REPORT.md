# LAPORAN AUDIT & REMEDIASI HARGA MUTASI LUAR DAERAH (SSoT)
**Sistem:** SUNBiroJasa / Admin SUN89  
**Workspace:** `D:\Admin\adminsunbirojasa`  
**Mode:** Single Source of Truth (SSoT) Architecture, Implementation & Automated Verification  
**Tanggal:** 9 November 2026  
**Status:** **SELESAI & TERVERIFIKASI PENUH (100% PASS)**

---

## 1. AUDIT DATA FLOW AKTUAL

Berdasarkan audit source code menyeluruh, data flow tarif dan estimasi biaya layanan sebelum perbaikan adalah sebagai berikut:

```
+-------------------------------------------------------------+
| 1. Master Data > Biaya Layanan                              |
|    - File: src/app/components/BiayaLayanan.tsx             |
|    - Sumber: pricingStore.biayaLayananRows                 |
|    - Nilai Mutasi LD Mobil: Rp 1.500.000                   |
+-------------------------------------------------------------+
                               | (Terputus / Disconnected)
                               v
+-------------------------------------------------------------+
| 2. Modal Aturan Estimasi & Komponen General                 |
|    - File: src/app/data/estimationStore.ts                 |
|    - Template: DEFAULT_R4_MUTASI_LD_TEMPLATE                |
|    - Nilai Hardcoded Lama: Rp 750.000                       |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 3. Form Buat Order & Engine Estimasi                        |
|    - File: src/domain/estimation/estimationEngine.ts        |
|    - Rule: PROSES_DAN_JASA_MUTASI                           |
|    - Nilai Hardcoded Return: Rp 750.000                     |
+-------------------------------------------------------------+
```

### Temuan Penelusuran 9 Titik Audit:
1. **Sumber data tarif tabel luar (`BiayaLayanan.tsx`):** Membaca dari `pricingStore.biayaLayananRows` yang diinisialisasi dari `INITIAL_BIAYA_LAYANAN_ROWS` dengan nominal Rp 1.500.000 untuk Mutasi Luar Daerah.
2. **Sumber data modal Aturan Estimasi:** Membaca dari `estimationStore.getTemplate("template-mutasi-ld-r4")` yang diinisialisasi dari `DEFAULT_R4_MUTASI_LD_TEMPLATE` dengan nilai hardcoded Rp 750.000.
3. **Sumber data Buat Order (`BuatOrder.tsx`):** Memanggil `calculateEstimationResult` pada `estimationEngine.ts`. Engine mengevaluasi rule `PROSES_DAN_JASA_MUTASI` yang mengembalikan hardcoded `750000` tanpa mereferensikan konfigurasi Samsat atau template `biayaJasa`.
4. **Lifecycle pemuatan template default:** `estimationStore.ts` menyimpan cache di `localStorage` (`sun89_estimation_templates_v3`). Jika cache ada, sistem tidak memuat perubahan dari file source code kecuali di-reset atau versi cache dinaikkan.
5. **Penyimpanan override Samsat:** `pricingStore.serviceFeeConfigs` dan `biayaLayananRows` menyimpan override per-Samsat (misal Tangerang Selatan Rp 1.475.000). Namun, `BuatOrder.tsx` tidak menghubungkan override ini ke engine estimasi kategori JASA untuk Mutasi Luar Daerah.
6. **Diferensiasi Kendaraan R4 vs R2:** Dibedakan melalui `vehicleType` ("Mobil" vs "Motor") yang merujuk ke template terpisah (`template-mutasi-ld-r4` vs `template-mutasi-ld-r2`).
7. **Relasi FEE-01 dan PROSES_DAN_JASA_MUTASI:** Komponen pada template memiliki kode `FEE-01` dan ruleId `PROSES_DAN_JASA_MUTASI`. Namun engine mengabaikan `component.defaultValue` dan menggunakan hardcoded literal `750000`.
8. **Duplikasi konfigurasi:** Terdapat duplikasi definisi biaya jasa di tiga layer berbeda tanpa resolver terpadu.
9. **Dampak terhadap order historis:** Order historis menyimpan snapshot biaya pada properti `costBreakdown` dan `invoice.items`. Evaluasi ulang order lama tidak boleh meregenerasi atau mengubah snapshot finansial yang sudah terbentuk.

---

## 2. ROOT CAUSE KETIDAKSINKRONAN HARGA

1. **Hardcoded Literal pada Engine Estimasi (`src/domain/estimation/estimationEngine.ts`):**  
   Rule `PROSES_DAN_JASA_MUTASI` secara kaku mengembalikan nilai Rp 750.000, mengabaikan konfigurasi dinamis `ctx.template.biayaJasa`.
2. **Template Default Tidak Sinkron (`src/domain/estimation/defaultTemplates.ts`):**  
   `DEFAULT_R4_MUTASI_LD_TEMPLATE` mendefinisikan `biayaJasa: 750000` dan komponen `proses-dan-jasa` bernilai Rp 750.000, padahal tabel standar bisnis Mutasi LD Mobil menetapkan Rp 1.500.000.
3. **Absennya Pricing Resolver SSoT:**  
   Tidak ada layer resolusi tunggal yang memediasi prioritas harga antara Samsat Custom Override, Service Standard, dan Template Default.
4. **Stale Cache di LocalStorage Browser:**  
   Browser menyimpan template versi lama di bawah kunci `sun89_estimation_templates_v3`, sehingga reload biasa tanpa migrasi cache tetap mempertahankan Rp 750.000.

---

## 3. ARSITEKTUR & SUMBER KONFIGURASI SSoT

Telah diimplementasikan arsitektur **Single Source of Truth (SSoT)** dengan hirarki resolusi prioritas yang ketat dan aman (*fail-closed*):

```
                       [ Input Permintaan Tarif ]
               (serviceName, samsatName, vehicleType, tpl)
                                   |
                                   v
             +-------------------------------------------+
             | Apakah Konfigurasi Valid & Tidak Rusak?   |
             +-------------------------------------------+
                     |                          |
                    (Ya)                      (Tidak)
                     |                          |
                     v                          v
      +-----------------------------+   [ THROW ERROR / FAIL-CLOSED ]
      | Apakah Layanan Khusus?      |   (Cegah transaksi undercharge)
      | (e.g. Tanpa KTP / Nembak)   |
      +-----------------------------+
         | (Ya)                 | (Tidak)
         v                      v
  [ SPECIAL_SERVICE ]   +-----------------------------+
  (Tarif Khusus Samsat) | Apakah Jasa Dinonaktifkan?  |
                        +-----------------------------+
                           | (Ya)                 | (Tidak)
                           v                      v
                     [ INACTIVE ]       +-------------------------------+
                     (Rp 0 & Excluded)  | Apakah Ada Override Samsat?   |
                                        +-------------------------------+
                                           | (Ya)                   | (Tidak)
                                           v                        v
                                    [ SAMSAT OVERRIDE ]     [ TEMPLATE DEFAULT ]
                                    (e.g. Tangsel: 1.475M)  (Mobil: Rp 1.500.000)
                                                            (Motor: Rp 500.000)
```

### Prioritas Resolusi:
1. **Validation & Fail-Closed Guard:** Memvalidasi tipe numerik dan non-negatif. Mencegah kalkulasi jika konfigurasi korup.
2. **Special Service (Tanpa KTP):** Jika `isKhusus` bernilai true, mengambil tarif khusus/nembak dari Samsat.
3. **Deactivated Component Check:** Jika toggle jasa dimatikan (`jasaLengkap.enabled === false` atau `isActive === false`), tarif menjadi Rp 0 dan dikeluarkan dari total estimasi.
4. **Samsat Specific Override:** Jika Samsat memiliki override kustom (ditandai `isCustom` atau nominal berbeda dari baseline standar), tarif Samsat tersebut yang digunakan.
5. **Template & Service Default:** Jika tidak ada override, fallback secara deterministik ke template default (Rp 1.500.000 untuk Mobil R4, Rp 500.000 untuk Motor R2).
6. **Immutability:** Template dikloning secara mendalam (`structuredClone` / immutable map) per kalkulasi untuk mencegah mutasi state global atau kebocoran lintas Samsat/kendaraan.

---

## 4. BERKAS YANG DIUBAH & ALASAN PERUBAHAN

| File | Alasan Perubahan |
|---|---|
| `src/domain/pricing/types.ts` | Menambahkan interface contract `ServiceFeeResolutionInput` dan `ResolvedServiceFee` |
| `src/domain/pricing/pricingResolver.ts` | Mengimplementasikan fungsi murni `resolveServiceFee(...)` berprinsip SSoT dan fail-closed |
| `src/domain/estimation/defaultTemplates.ts` | Menyelaraskan `DEFAULT_R4_MUTASI_LD_TEMPLATE` menjadi Rp 1.500.000 (Mobil R4) sambil mempertahankan Motor R2 (Rp 500.000) dan layanan non-LD (Rp 750.000) |
| `src/domain/estimation/estimationEngine.ts` | Mengubah rule `PROSES_DAN_JASA_MUTASI` agar dinamis menggunakan `ctx.template.biayaJasa` dengan fallback standar yang tepat |
| `src/app/data/estimationStore.ts` | Menaikkan cache storage ke `v4` dan menambahkan migrasi otomatis untuk membersihkan cache usang Rp 750.000 di browser pengguna |
| `src/app/components/BuatOrder.tsx` | Menghubungkan `resolveServiceFee` ke seluruh alur kalkulasi form Buat Order dan memastikan Jasa dinonaktifkan tidak dihitung ke Grand Total |
| `src/app/components/BiayaLayanan.tsx` | Menyinkronkan perubahan tarif pada modal ke `biayaJasa` template, `SERVICE_STANDARD_BASELINES`, dan broadcast ke Samsat standar |
| `tests/mutasi-ld-pricing-ssot.test.ts` | Suite pengujian otomatis mencakup 12 skenario pengujian bisnis SSoT |
| `tests/estimation-extended.test.ts` | Menambahkan assertion verifikasi Mutasi LD Mobil Rp 1.500.000 |

---

## 5. PENJELASAN PERUBAHAN KODE

### A. Resolusi Tarif SSoT (`src/domain/pricing/pricingResolver.ts`)
```typescript
export function resolveServiceFee(input: ServiceFeeResolutionInput): ResolvedServiceFee {
  const { serviceName, samsatName, vehicleType, templateBiayaJasa, isKhusus, pricingStore } = input;

  // 1. Fail-closed validation
  if (templateBiayaJasa !== undefined && (typeof templateBiayaJasa !== "number" || isNaN(templateBiayaJasa) || templateBiayaJasa < 0)) {
    throw new Error(`[PricingResolver Fail-Closed] Invalid template biayaJasa: ${templateBiayaJasa}`);
  }

  // 2. Samsat lookup & Special service handling
  // 3. Deactivation handling (enabled === false -> Rp 0)
  // 4. Per-Samsat override vs Baseline
  // 5. Canonical Template fallback (Mobil: 1.500.000, Motor: 500.000)
}
```

### B. Template Standar Mutasi LD R4 (`src/domain/estimation/defaultTemplates.ts`)
```typescript
export const DEFAULT_R4_MUTASI_LD_TEMPLATE: EstimationTemplate = {
  id: "template-mutasi-ld-r4",
  name: "Mutasi Luar Daerah (Mobil R4)",
  biayaJasa: 1500000, // Diperbarui dari 750.000 ke 1.500.000
  components: [
    {
      id: "proses-dan-jasa",
      name: "Proses dan Jasa",
      category: "JASA",
      ruleId: "PROSES_DAN_JASA_MUTASI",
      defaultValue: 1500000, // Diperbarui dari 750.000 ke 1.500.000
      description: "Biaya Proses dan Jasa Mutasi LD Mobil Rp 1.500.000",
      isActive: true,
      includesInTotal: true,
    },
    // ...
  ]
};
```

### C. Engine Estimasi Dinamis (`src/domain/estimation/estimationEngine.ts`)
```typescript
{
  id: 'PROSES_DAN_JASA_MUTASI',
  name: 'Biaya Proses dan Jasa Mutasi',
  description: 'Komponen proses dan jasa layanan mutasi kendaraan',
  calculate: (ctx) => {
    // SSoT: Mengambil nilai dinamis dari template.biayaJasa
    if (typeof ctx.template.biayaJasa === 'number' && ctx.template.biayaJasa > 0) {
      return ctx.template.biayaJasa;
    }
    const isLuarDaerah = ctx.template.name.toLowerCase().includes('luar daerah') || ctx.template.id.includes('ld');
    const isMobil = ctx.template.id.includes('r4') || ctx.template.name.toLowerCase().includes('r4');
    if (isLuarDaerah) {
      return isMobil ? 1500000 : 500000;
    }
    return 750000;
  },
}
```

---

## 6. COMMAND PENGUJIAN & EXIT CODES

Seluruh pengujian dijalankan dengan isolasi database dan lingkungan yang aman:

| Command | Target Uji | Exit Code | Hasil |
|---|---|:---:|:---:|
| `npx tsx --test tests/mutasi-ld-pricing-ssot.test.ts` | 12 Skenario Pengujian SSoT Tarif Mutasi LD | **0** | **12/12 PASS** |
| `npx tsx --test tests/estimation-extended.test.ts` | Extended Estimation Suite | **0** | **11/11 PASS** |
| `node scripts/run-test-isolated.cjs tests/e2e-business-financial-reconciliation.test.ts` | Rekonsiliasi Finansial & Gating Payout | **0** | **10/10 PASS** |
| `npx playwright test e2e/data-penjualan-feedback.spec.ts` | Browser E2E Mutation & Error Feedback Lifecycle | **0** | **1/1 PASS** |
| `npm run lint` | ESLint Code Quality Guard | **0** | **0 Errors PASS** |
| `npm run typecheck` | TypeScript Compiler (Client & Server) | **0** | **0 Errors PASS** |
| `npm run build` | Vite Production Bundle Build | **0** | **Build PASS (37.9s)** |

---

## 7. HASIL 12 SKENARIO PENGUJIAN BISNIS

| No | Skenario Pengujian | Hasil Pengujian | Status |
|:--:|---|---|:---:|
| 1 | **Mutasi LD Mobil R4 Standar** (Aceh Jaya) | Mengembalikan `Rp 1.500.000` (Source: `TEMPLATE_DEFAULT`) | **PASS** |
| 2 | **Mutasi LD Motor R2 Standar** (Aceh Jaya) | Mengembalikan `Rp 500.000` (Source: `TEMPLATE_DEFAULT`) | **PASS** |
| 3 | **Isolasi Layanan Non-LD: Balik Nama R4** | Tetap `Rp 750.000`, tidak terpengaruh tarif Mutasi LD | **PASS** |
| 4 | **Isolasi Layanan Non-LD: Mutasi Antar Samsat R4** | Tetap `Rp 750.000`, tidak terpengaruh tarif Mutasi LD | **PASS** |
| 5 | **Prioritas Override Samsat (Tangerang Selatan R4)** | Mengembalikan tarif khusus `Rp 1.475.000` (Source: `SAMSAT_OVERRIDE`) | **PASS** |
| 6 | **Deaktivasi Komponen Jasa** | Mengembalikan `Rp 0` dan dikeluarkan dari Grand Total | **PASS** |
| 7 | **Reaktivasi Komponen Jasa** | Mengembalikan nilai semula `Rp 1.500.000` secara utuh | **PASS** |
| 8 | **Layanan Khusus (Tanpa KTP / Nembak)** | Mengembalikan tarif khusus `Rp 2.250.000` (Source: `SPECIAL_SERVICE`) | **PASS** |
| 9 | **Perlindungan Fail-Closed (Data Korup/Negatif)** | Melempar Exception terstruktur dan menolak kalkulasi | **PASS** |
| 10 | **Immutabilitas & Non-Pollution State** | Kloning independen, kalkulasi tidak mengubah template asli | **PASS** |
| 11 | **Persistence Round-Trip & Migrasi Cache** | Cache v3 bermigrasi otomatis ke v4 (Rp 1.500.000) tanpa reset manual | **PASS** |
| 12 | **Preservasi Snapshot Historis** | Invoice dan order lama mempertahankan nilai historis aslinya | **PASS** |

---

## 8. BUKTI INTEGRITAS DATABASE OPERASIONAL (SHA-256)

Database operasional (`server/data/database.sqlite`) dijaga dengan *fail-safe* ketat selama proses berlangsung:

| Parameter | Baseline Sebelum Pekerjaan | Setelah Pekerjaan & Pengujian | Status |
|---|---|---|:---:|
| **File Path** | `server/data/database.sqlite` | `server/data/database.sqlite` | Terjaga |
| **Ukuran File** | `1.441.792 bytes` | `1.441.792 bytes` | **Identik** |
| **SHA-256 Hash** | `d560674ccd917049241415018fa00a4cf21b78bb9103f380c808b3b90408171c` | `d560674ccd917049241415018fa00a4cf21b78bb9103f380c808b3b90408171c` | **100% Identik (0 Mutasi)** |

---

## 9. REGRESSION FINDINGS

1. **Zero Financial Mutation:** Tidak ditemukan mutasi atau regresi pada modul finance, order lifecycle, invoice numbering, ledger kas, maupun payout gating.
2. **Double-Submit Prevention:** Pengujian browser membuktikan proteksi double-submit pada tombol dan modal berfungsi dengan baik.
3. **TypeScript & Bundling Integrity:** Seluruh kompilasi TypeScript dan build produksi Vite berjalan mulus tanpa error.

---

## 10. HAL-HAL YANG BELUM TERVERIFIKASI SECARA OPERASIONAL

1. **Browser Client Cache Eksisting Milik Pengguna Luar:** Meskipun cache local storage sudah dimigrasikan secara otomatis melalui mekanisme `sun89_estimation_templates_v4`, browser pihak ketiga yang menyimpan service worker atau hard asset HTML lama perlu melakukan hard refresh (`Ctrl + F5`) untuk memuat bundle JavaScript terbaru.
2. **Koneksi Multi-User Concurrent Edit pada Master Data:** Jika dua pengguna mengedit modal aturan estimasi secara bersamaan pada waktu yang sama, sistem menggunakan *last-write-wins* di client storage lokal sebelum tersinkronisasi ke server.
