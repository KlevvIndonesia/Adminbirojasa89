import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('MASTER LAYANAN + FINANCE PROFIT & LABA RUGI — UI/UX AND FUNCTIONAL IMPROVEMENT', () => {
  const masterLayananPath = path.resolve('src/app/components/MasterLayanan.tsx');
  const financeContentPath = path.resolve('src/app/components/FinanceContent.tsx');
  const paymentSummaryPath = path.resolve('src/app/components/FinancePaymentMethodSummary.tsx');

  const masterLayananCode = fs.readFileSync(masterLayananPath, 'utf8');
  const financeContentCode = fs.readFileSync(financeContentPath, 'utf8');
  const paymentSummaryCode = fs.readFileSync(paymentSummaryPath, 'utf8');

  // ==========================================
  // PHASE 1 — MASTER DATA > LAYANAN
  // ==========================================
  it('Phase 1: Master Layanan typography hierarchy and long text wrapping', () => {
    // 1. Service name: semibold
    assert.ok(
      masterLayananCode.includes('text-base font-semibold text-foreground'),
      'Service name must be font-semibold and primary card focal point'
    );

    // 2. Service description: regular, smaller, secondary color
    assert.ok(
      masterLayananCode.includes('text-xs font-normal text-muted-foreground mt-1 line-clamp-2 leading-relaxed'),
      'Service description must be regular text-xs secondary'
    );

    // 3. Document section heading: medium text-xs
    assert.ok(
      masterLayananCode.includes('font-medium text-xs text-foreground flex items-center gap-1.5'),
      'Document section heading must be font-medium'
    );

    // 4. Document chips: medium, break-words (no truncate cutting text off)
    assert.ok(
      masterLayananCode.includes('break-words') && !masterLayananCode.includes('truncate max-w-[200px]'),
      'Document chips must wrap long text with break-words instead of truncating at 200px'
    );

    // 5. Service ID: regular
    assert.ok(
      masterLayananCode.includes('text-[11px] font-normal text-muted-foreground'),
      'Service ID label must be regular visual secondary'
    );

    // 6. Status Aktif/Nonaktif: medium
    assert.ok(
      masterLayananCode.includes('font-medium px-2 py-0.5'),
      'Status badge must use font-medium'
    );

    // 7. Edit button: medium
    assert.ok(
      masterLayananCode.includes('h-8 text-xs font-medium gap-1.5'),
      'Edit button must use font-medium'
    );
  });

  // ==========================================
  // PHASE 2 — FINANCE > PROFIT
  // ==========================================
  it('Phase 2: Finance Profit layout, filters, and standard FinanceSummary', () => {
    // 1. Filter labels in PaymentMethodSummary are normalized (not overly tiny)
    assert.ok(
      paymentSummaryCode.includes('text-xs font-medium text-foreground/80'),
      'Filter labels must use readable text-xs font-medium'
    );

    // 2. Summary table cells in PaymentMethodSummary have proper tabular-nums and padding
    assert.ok(
      paymentSummaryCode.includes('font-mono tabular-nums font-semibold text-emerald-600'),
      'Total Uang Masuk cells must use font-mono tabular-nums font-semibold'
    );

    // 3. Profit table card uses standardized maximized viewport height
    assert.ok(
      financeContentCode.includes('md:h-[calc(100vh-140px)] min-h-[500px] flex flex-col shrink-0'),
      'Profit table card must use standardized viewport height'
    );

    // 4. Extract profit section accurately
    const profitStart = financeContentCode.indexOf('if (tab === "profit") {');
    const profitEnd = financeContentCode.indexOf('if (tab === "kas-messenger") {', profitStart);
    const profitSection = financeContentCode.slice(profitStart, profitEnd);

    assert.ok(
      profitSection.includes('<FinanceSummary'),
      'Profit tab must use standardized FinanceSummary below the table'
    );
    assert.ok(
      profitSection.includes('id: "total-uang-masuk"'),
      'Must contain Total Uang Masuk summary item'
    );
    assert.ok(
      profitSection.includes('id: "total-biaya-samsat"'),
      'Must contain Total Biaya Pokok Samsat summary item'
    );
    assert.ok(
      profitSection.includes('id: "total-gross-margin"'),
      'Must contain Total Gross Service Margin summary item'
    );

    // 5. Assert manual icon cards were removed from Profit tab
    assert.ok(
      !profitSection.includes('<ArrowUpRight className="w-5 h-5" />'),
      'Decorative ArrowUpRight icon must not be in Profit summary'
    );
  });

  // ==========================================
  // PHASE 3 — FINANCE > LABA RUGI
  // ==========================================
  it('Phase 3: Finance Laba Rugi two layers, cash flow reconciliation, and FinanceSummary', () => {
    const labaRugiStart = financeContentCode.indexOf('if (tab === "laba-rugi") {');
    const labaRugiEnd = financeContentCode.indexOf('if (tab === "belum-bayar") {', labaRugiStart);
    const labaRugiSection = financeContentCode.slice(labaRugiStart, labaRugiEnd);

    // 1. Layer 1: Cash Basis exists with 3 cards
    assert.ok(
      labaRugiSection.includes('Lapisan 1: Cash Basis'),
      'Must contain Lapisan 1: Cash Basis'
    );
    assert.ok(
      labaRugiSection.includes('Kas Kantor'),
      'Must contain Kas Kantor card'
    );
    assert.ok(
      labaRugiSection.includes('Kas Messenger'),
      'Must contain Kas Messenger card'
    );
    assert.ok(
      labaRugiSection.includes('Rekap Arus Kas Bersih'),
      'Must contain Rekap Arus Kas Bersih card'
    );

    // 2. Layer 2: Accrual / P&L exists
    assert.ok(
      labaRugiSection.includes('Lapisan 2: Akrual / P&L'),
      'Must contain Lapisan 2: Akrual / P&L'
    );
    assert.ok(
      labaRugiSection.includes('Grafik perbandingan pendapatan & pengeluaran'),
      'Must contain comparative chart'
    );

    // 3. Pending transactions and P&L summaries use standardized FinanceSummary
    assert.ok(
      labaRugiSection.includes('Rekonsiliasi Transaksi Terpending'),
      'Must contain Pending Transactions Reconciliation section'
    );
    assert.ok(
      labaRugiSection.includes('Ringkasan Kinerja Laba Rugi Sah'),
      'Must contain Net P&L Summary section'
    );
    assert.ok(
      labaRugiSection.includes('id: "pending-unpaid"') &&
      labaRugiSection.includes('id: "pending-profit"') &&
      labaRugiSection.includes('id: "pending-cashback"'),
      'Pending indicators must be rendered via FinanceSummary'
    );
    assert.ok(
      labaRugiSection.includes('id: "total-penerimaan-sah"') &&
      labaRugiSection.includes('id: "total-beban-pengeluaran"') &&
      labaRugiSection.includes('id: "laba-rugi-bersih"'),
      'Net P&L metrics must be rendered via FinanceSummary'
    );

    // 4. Breakdown Cards: Rincian Pendapatan & Rincian Beban
    assert.ok(
      labaRugiSection.includes('Rincian Pendapatan Sah') &&
      labaRugiSection.includes('Rincian Beban & Pengeluaran Sah'),
      'Must contain refined breakdown cards'
    );
  });

  // ==========================================
  // PHASE 4 — FUNCTIONAL AUDIT
  // ==========================================
  it('Phase 4: Functional controls across Master Layanan, Profit, and Laba Rugi are intact', () => {
    // Master Layanan controls
    assert.ok(masterLayananCode.includes('refreshServices()'), 'Segarkan must be wired');
    assert.ok(masterLayananCode.includes('handleOpenEdit(svc)'), 'Edit Layanan opener must be wired');
    assert.ok(masterLayananCode.includes('handleSave'), 'Save handler must be wired');
    assert.ok(masterLayananCode.includes('handleAddRequirement'), 'Add requirement handler must be wired');
    assert.ok(masterLayananCode.includes('handleRemoveRequirement'), 'Remove requirement handler must be wired');

    // Profit controls
    assert.ok(financeContentCode.includes('selectedMethod={profitPaymentFilter}'), 'Payment method filter must be wired');
    assert.ok(financeContentCode.includes('startDate={profitStartDate}'), 'Start date filter must be wired');
    assert.ok(financeContentCode.includes('endDate={profitEndDate}'), 'End date filter must be wired');
    assert.ok(financeContentCode.includes('selectedStatus={profitPengurusanFilter}'), 'Pengurusan filter must be wired');
    assert.ok(financeContentCode.includes('setViewingItem({ item, subTabTitle: "Profit"'), 'Transaction detail viewer must be wired');

    // Laba Rugi controls
    assert.ok(financeContentCode.includes('setFilterPeriod'), 'Period selector must be wired');
    assert.ok(financeContentCode.includes('setLrCustomStartDate'), 'Custom start date must be wired');
    assert.ok(financeContentCode.includes('setLrCustomEndDate'), 'Custom end date must be wired');
    assert.ok(financeContentCode.includes('setIsMessengerBreakdownOpen'), 'Messenger breakdown toggle must be wired');
    assert.ok(financeContentCode.includes('setIsAnomalyDrawerOpen'), 'Anomaly drawer toggle must be wired');
  });
});
