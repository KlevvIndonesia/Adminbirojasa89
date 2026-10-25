# ARSIP STUB CLIENT API (LEGACY / EXPERIMENTAL)

> [!NOTE]
> Modul di dalam folder ini (`src/legacy_stubs/api/`) merupakan arsip template Axios client awal yang menggunakan skema `/api/v1`.
> 
> **Lapisan Data Aktif Sistem:**
> Seluruh komunikasi frontend dengan Express backend menggunakan arsitektur aktif di:
> - **API Providers:** `src/data/api/*` (misal: `orderApiProvider.ts`, `financeApiProvider.ts`, `messengerApiProvider.ts`)
> - **Repositories:** `src/data/repositories/*`
> - **State Stores:** `src/app/data/*` (misal: `orderStore.ts`, `financeStore.ts`)
> 
> Folder ini diarsipkan agar tidak menimbulkan ambiguitas arsitektural bagi tim pengembang.
