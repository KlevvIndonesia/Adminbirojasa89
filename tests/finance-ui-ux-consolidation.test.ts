import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('FINANCE UI/UX CONSOLIDATION — Verification Suite', () => {
  const financeContentPath = path.resolve('src/app/components/FinanceContent.tsx');
  const dataPenjualanPath = path.resolve('src/app/components/DataPenjualan.tsx');
  const enhancedTablePath = path.resolve('src/app/components/EnhancedTableWithDialogs.tsx');
  const financeSummaryPath = path.resolve('src/app/components/finance/FinanceSummary.tsx');
  const financeWrapperPath = path.resolve('src/app/components/Finance.tsx');

  const financeContentCode = fs.readFileSync(financeContentPath, 'utf8');
  const dataPenjualanCode = fs.readFileSync(dataPenjualanPath, 'utf8');
  const enhancedTableCode = fs.readFileSync(enhancedTablePath, 'utf8');
  const financeSummaryCode = fs.readFileSync(financeSummaryPath, 'utf8');
  const financeWrapperCode = fs.readFileSync(financeWrapperPath, 'utf8');

  it('1. Shared FinanceSummary Component exists and satisfies visual rules', () => {
    assert.ok(fs.existsSync(financeSummaryPath), 'FinanceSummary component must exist');
    // Verifies semantic text coloring
    assert.ok(financeSummaryCode.includes('text-emerald-600'), 'Inflow must use green');
    assert.ok(financeSummaryCode.includes('text-rose-600'), 'Outflow must use red');
    assert.ok(financeSummaryCode.includes('text-foreground'), 'Neutral must use foreground');
    // Verifies neutral card styling (no decorative backgrounds or colored card borders)
    assert.ok(financeSummaryCode.includes('bg-card'), 'Must use neutral bg-card');
    assert.ok(financeSummaryCode.includes('border-border'), 'Must use neutral border');
  });

  it('2. Viewport-based table layout in EnhancedTableWithDialogs removes magic max-h calculations', () => {
    // Assert arbitrary calc(100vh - 270px) and calc(100vh - 380px) are removed
    assert.ok(!enhancedTableCode.includes('calc(100vh-270px)'), 'Arbitrary calc(100vh-270px) must be eliminated');
    assert.ok(!enhancedTableCode.includes('calc(100vh-380px)'), 'Arbitrary calc(100vh-380px) must be eliminated');
    // Assert flex-1 min-h-0 viewport allocation is used
    assert.ok(enhancedTableCode.includes('flex-1 min-h-[160px] md:min-h-0 overflow-y-auto overflow-x-auto'), 'Must use pure flexbox viewport container');
  });

  it('3. Finance.tsx and Table Cards prioritize table height and allow scroll to summary', () => {
    // Assert global overflow-hidden is eliminated from Finance.tsx so summary can be reached via scroll
    assert.ok(!financeWrapperCode.includes('overflow-hidden'), 'Must NOT lock overflow-hidden globally so summary is reachable via scroll');
    // Assert table cards use maximized viewport calculations (prioritizing table height)
    assert.ok(financeContentCode.includes('md:h-[calc(100vh-'), 'FinanceContent table cards must use maximized viewport calculations');
    assert.ok(dataPenjualanCode.includes('md:h-[calc(100vh-140px)]'), 'Data Penjualan must maximize viewport height for table card');
    // Assert summary is in normal document flow below table
    assert.ok(dataPenjualanCode.includes('FinanceSummary\n          items='), 'Data Penjualan summary must be placed below table in normal flow');
  });

  it('4. Global Rule: "Kirim WA" action is removed from table action columns', () => {
    // In Belum Bayar and Cashback Pending, Aksi column must not have Kirim WA button
    const belumBayarAksiMatch = financeContentCode.match(/key:\s*"aksi"[\s\S]*?render:[\s\S]*?Bayar \/ Lunasi[\s\S]*?Detail/);
    assert.ok(belumBayarAksiMatch, 'Belum Bayar aksi block must exist');
    assert.ok(!belumBayarAksiMatch[0].includes('Kirim WA'), 'Belum Bayar aksi must NOT contain Kirim WA button');

    const cashbackAksiMatch = financeContentCode.match(/key:\s*"aksi"[\s\S]*?render:[\s\S]*?Cairkan[\s\S]*?Detail/);
    assert.ok(cashbackAksiMatch, 'Cashback Pending aksi block must exist');
    assert.ok(!cashbackAksiMatch[0].includes('Kirim WA'), 'Cashback Pending aksi must NOT contain Kirim WA button');
  });

  it('5. Communication integrity: Customer phone column retains WhatsApp direct link', () => {
    assert.ok(financeContentCode.includes('https://wa.me/${waPhone}'), 'WhatsApp URL link must be preserved in phone column');
    assert.ok(financeContentCode.includes('Hubungi WA'), 'Phone column WA trigger must be preserved');
  });

  it('6. Belum & Kurang Bayar: Status Supervisi moved from Aksi to Status Pengerjaan', () => {
    // Assert Status Pengerjaan column renders contextual supervisor gating
    assert.ok(financeContentCode.includes('Menunggu Supervisi Biaya'), 'Status Pengerjaan must render Menunggu Supervisi Biaya');
    assert.ok(financeContentCode.includes('Menunggu Supervisi Pembayaran'), 'Status Pengerjaan must render Menunggu Supervisi Pembayaran');
    
    // Assert Bayar / Lunasi uses Option A (visible and disabled during gating with reason tooltip)
    assert.ok(financeContentCode.includes('disabled={isGated}'), 'Bayar / Lunasi button must be disabled when gated');
    assert.ok(financeContentCode.includes('title={isGated ? `Pembayaran ditahan:'), 'Bayar / Lunasi must display gating reason in title');
  });

  it('7. Cashback Terpending: Status Supervisi moved to Status column & Cairkan disabled when gated', () => {
    assert.ok(financeContentCode.includes('item.isPayoutGated'), 'Cashback must inspect isPayoutGated');
    assert.ok(financeContentCode.includes('disabled={isGated}'), 'Cairkan button must be disabled when gated');
    assert.ok(financeContentCode.includes('title={isGated ? `Pencairan belum dapat diproses:'), 'Cairkan must display gating reason in title');
  });

  it('8. Data Penjualan: Redundant service title badge removed and FinanceSummary adopted', () => {
    assert.ok(dataPenjualanCode.includes('<FinanceSummary'), 'Data Penjualan must render FinanceSummary');
    // Ensure {currentMeta.title} is not rendered as badge inside summary cards
    assert.ok(!dataPenjualanCode.includes('{currentMeta.title}</span>\n                    </div>\n                    <div className="flex items-baseline'), 'Redundant service badge must be removed from summary');
  });

  it('9. Kas Messenger: Both Buku Kas and Reimbursement use standardized bottom summary', () => {
    assert.ok(financeContentCode.includes('Replaced Kas Messenger Buku Kas summary') || financeContentCode.includes('id: "kas-masuk"'), 'Buku Kas must use FinanceSummary');
    assert.ok(financeContentCode.includes('id: "reimb-submitted"'), 'Reimbursement must use FinanceSummary');
    assert.ok(financeContentCode.includes('id: "reimb-paid"'), 'Reimbursement paid must be tracked');
  });

  it('10. Financial calculations and metric contracts across all 6 tabs', () => {
    // Kas Messenger Buku Kas
    assert.ok(financeContentCode.includes('totalKasMasuk'), 'totalKasMasuk calculation preserved');
    assert.ok(financeContentCode.includes('totalKasKeluar'), 'totalKasKeluar calculation preserved');
    assert.ok(financeContentCode.includes('sisaSaldoMessenger'), 'sisaSaldoMessenger calculation preserved');

    // Kas Kantor
    assert.ok(financeContentCode.includes('totalDebit'), 'totalDebit calculation preserved');
    assert.ok(financeContentCode.includes('totalKredit'), 'totalKredit calculation preserved');
    assert.ok(financeContentCode.includes('saldoAkhirKantor'), 'saldoAkhirKantor calculation preserved');

    // Belum & Kurang Bayar
    assert.ok(financeContentCode.includes('totalSemuaPiutang'), 'totalSemuaPiutang calculation preserved');

    // Profit Terpending
    assert.ok(financeContentCode.includes('totalMasukPending'), 'totalMasukPending calculation preserved');
    assert.ok(financeContentCode.includes('totalDanaTitipan'), 'totalDanaTitipan calculation preserved');
    assert.ok(financeContentCode.includes('totalSelisihKas'), 'totalSelisihKas calculation preserved');
    assert.ok(financeContentCode.includes('totalEstimasiProfit'), 'totalEstimasiProfit calculation preserved');

    // Cashback Terpending
    assert.ok(financeContentCode.includes('totalKelebihan'), 'totalKelebihan calculation preserved');
    assert.ok(financeContentCode.includes('totalPendingCount'), 'totalPendingCount calculation preserved');
    assert.ok(financeContentCode.includes('totalSudahDibayarCount'), 'totalSudahDibayarCount calculation preserved');
  });
});
