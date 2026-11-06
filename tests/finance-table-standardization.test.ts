import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('FINANCE TABLE STANDARDIZATION — Verification Suite', () => {
  const globalsCssPath = path.resolve('src/styles/globals.css');
  const formattersPath = path.resolve('src/app/utils/financeFormatters.tsx');
  const enhancedTablePath = path.resolve('src/app/components/EnhancedTableWithDialogs.tsx');
  const financeContentPath = path.resolve('src/app/components/FinanceContent.tsx');
  const dataPenjualanPath = path.resolve('src/app/components/DataPenjualan.tsx');

  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
  const formattersCode = fs.readFileSync(formattersPath, 'utf8');
  const enhancedTableCode = fs.readFileSync(enhancedTablePath, 'utf8');
  const financeContentCode = fs.readFileSync(financeContentPath, 'utf8');
  const dataPenjualanCode = fs.readFileSync(dataPenjualanPath, 'utf8');

  // ==========================================
  // REQUIREMENT 1: REDUCE TYPOGRAPHY BY 2PX
  // ==========================================
  describe('1. Table Typography Reduction by 2px', () => {
    it('globals.css reduces table font-size baseline from 12px (0.75rem) to 10px (0.625rem)', () => {
      assert.ok(
        globalsCss.includes('.finance-table--font-1') &&
        globalsCss.includes('0.625rem'),
        '.finance-table--font-1 must set 0.625rem (10px, 2px reduction from 12px)'
      );
      assert.ok(
        globalsCss.includes('.finance-table--font-2') &&
        globalsCss.includes('0.75rem'),
        '.finance-table--font-2 must set 0.75rem (12px, 2px reduction from 14px)'
      );
      assert.ok(
        globalsCss.includes('.finance-table--font-3') &&
        globalsCss.includes('0.875rem'),
        '.finance-table--font-3 must set 0.875rem (14px, 2px reduction from 16px)'
      );
    });

    it('EnhancedTableWithDialogs uses text-[10px] for headers and body cells', () => {
      assert.ok(
        enhancedTableCode.includes('whitespace-nowrap text-[10px]'),
        'TableHead must use text-[10px]'
      );
      assert.ok(
        enhancedTableCode.includes('px-3.5 py-2 text-[10px]'),
        'TableCell must use text-[10px]'
      );
    });

    it('PlateNumberBadge and PlainTextStatus use text-[10px]', () => {
      assert.ok(
        formattersCode.includes('finance-table__plate font-mono text-[10px]'),
        'PlateNumberBadge must use text-[10px]'
      );
      assert.ok(
        formattersCode.includes('text-[10px] font-semibold text-emerald-600') ||
        formattersCode.includes('text-[10px] font-normal text-foreground'),
        'PlainTextStatus must use text-[10px]'
      );
    });

    it('Kas Messenger Reimbursement table adopts finance-table typography classes', () => {
      assert.ok(
        financeContentCode.includes('finance-table finance-table--font-1'),
        'Kas Messenger Reimbursement table must adopt finance-table and finance-table--font-1'
      );
      assert.ok(
        financeContentCode.includes('finance-table__header') &&
        financeContentCode.includes('finance-table__body'),
        'Kas Messenger Reimbursement table must use standardized header and body typography'
      );
    });
  });

  // ==========================================
  // REQUIREMENT 2: EXPLICIT SAVE TABLE SETTINGS
  // ==========================================
  describe('2. Explicit Save Table Settings', () => {
    it('Pengaturan Tabel includes "Simpan Pengaturan" button with Save icon', () => {
      assert.ok(
        enhancedTableCode.includes('Simpan Pengaturan'),
        'Popover must contain "Simpan Pengaturan" button'
      );
      assert.ok(
        enhancedTableCode.includes('<Save className="w-3.5 h-3.5" />'),
        '"Simpan Pengaturan" button must render Save icon'
      );
    });

    it('Settings changes are kept in draft state until user saves', () => {
      assert.ok(
        enhancedTableCode.includes('draftTableFontSize') &&
        enhancedTableCode.includes('savedTableFontSize'),
        'Must distinguish draftTableFontSize from savedTableFontSize'
      );
      assert.ok(
        enhancedTableCode.includes('draftVisibleColumnKeys') &&
        enhancedTableCode.includes('savedVisibleColumnKeys'),
        'Must distinguish draftVisibleColumnKeys from savedVisibleColumnKeys'
      );
    });

    it('Displays indicator when unsaved draft changes exist', () => {
      assert.ok(
        enhancedTableCode.includes('hasUnsavedSettings'),
        'Must calculate hasUnsavedSettings boolean'
      );
      assert.ok(
        enhancedTableCode.includes('Terdapat perubahan yang belum disimpan'),
        'Must display warning indicator when there are unsaved settings'
      );
    });

    it('Reopening menu restores the last saved configuration', () => {
      assert.ok(
        enhancedTableCode.includes('setDraftTableFontSize(savedTableFontSize)') &&
        enhancedTableCode.includes('setDraftVisibleColumnKeys(new Set(savedVisibleColumnKeys))'),
        'Reopening or closing menu must reset draft to saved configuration'
      );
    });

    it('Retains Reset functionality', () => {
      assert.ok(
        enhancedTableCode.includes('handleResetTableSettings'),
        'handleResetTableSettings must be preserved'
      );
      assert.ok(
        enhancedTableCode.includes('Pengaturan tabel dikembalikan ke default'),
        'Reset must toast notification on restore to default'
      );
    });

    it('Table rendering uses saved settings, not uncommitted drafts', () => {
      assert.ok(
        enhancedTableCode.includes('savedTableFontSize === "1x"'),
        'Table class must use savedTableFontSize'
      );
      assert.ok(
        enhancedTableCode.includes('savedVisibleColumnKeys.has(col.key)'),
        'Table columns must check savedVisibleColumnKeys'
      );
    });
  });

  // ==========================================
  // REQUIREMENT 3: ROW NUMBERING (No.)
  // ==========================================
  describe('3. Row Numbering (No.) Across All Finance Tables', () => {
    it('Adds "No." as the first column in EnhancedTableWithDialogs TableHeader', () => {
      assert.ok(
        enhancedTableCode.includes('<TableHead className="h-9 px-2 font-semibold text-foreground/80 text-center whitespace-nowrap text-[10px] w-12 min-w-[48px] max-w-[48px] bg-card">\n                  No.\n                </TableHead>'),
        'No. column header must be the first TableHead'
      );
    });

    it('Calculates correct row number using pagination offset in EnhancedTableWithDialogs TableBody', () => {
      assert.ok(
        enhancedTableCode.includes('const rowNumber = (serverPageOffset !== undefined ? serverPageOffset : startIndex) + idx + 1;'),
        'Row number must use startIndex ((currentPage - 1) * itemsPerPage) + idx + 1'
      );
      assert.ok(
        enhancedTableCode.includes('{rowNumber}'),
        'TableCell must render {rowNumber}'
      );
    });

    it('"No." column is independent of column settings and cannot be hidden', () => {
      // "No." is directly hardcoded in TableHeader and TableBody, not part of `columns` prop
      assert.ok(
        !enhancedTableCode.includes('draftVisibleColumnKeys.has("no")') &&
        !enhancedTableCode.includes('visibleColumnKeys.has("no")'),
        '"No." column must NOT be toggleable in Pengaturan Tabel'
      );
    });

    it('EmptyState colSpan accounts for the additional No. column (+ 1)', () => {
      assert.ok(
        enhancedTableCode.includes('suppressTrailingActionColumn ? 0 : 1) + 1}'),
        'EmptyState colSpan must add 1 for the No. column'
      );
    });

    it('Kas Messenger Reimbursement table renders No. column in header and body', () => {
      assert.ok(
        financeContentCode.includes('<th className="py-2.5 px-3 text-center w-12 min-w-[48px] text-[10px] font-semibold">No.</th>'),
        'Reimbursement table must include No. in thead'
      );
      assert.ok(
        financeContentCode.includes('{idx + 1}'),
        'Reimbursement table must render {idx + 1} in the first cell'
      );
      assert.ok(
        financeContentCode.includes('colSpan={10}'),
        'Reimbursement empty state colSpan must be 10 (previously 9)'
      );
    });

    it('All Finance modules utilize EnhancedTableWithDialogs with No. column or explicit Reimbursement table', () => {
      // 1. Kas Messenger Buku Kas
      assert.ok(financeContentCode.includes('subTabTitle="Kas Messenger"'), 'Kas Messenger Buku Kas uses EnhancedTable');
      // 2. Kas Messenger Reimbursement
      assert.ok(financeContentCode.includes('filteredReimbursements.map'), 'Kas Messenger Reimbursement has row numbering');
      // 3. Kas Kantor
      assert.ok(financeContentCode.includes('subTabTitle="Kas Kantor"'), 'Kas Kantor uses EnhancedTable');
      // 4. Data Penjualan
      assert.ok(dataPenjualanCode.includes('subTabTitle={`Data Penjualan - ${currentMeta.title}`}'), 'Data Penjualan uses EnhancedTable');
      // 5. Belum & Kurang Bayar
      assert.ok(financeContentCode.includes('subTabTitle="Belum & Kurang Bayar"'), 'Belum Bayar uses EnhancedTable');
      // 6. Profit Terpending
      assert.ok(financeContentCode.includes('subTabTitle="Profit Terpending"'), 'Profit Terpending uses EnhancedTable');
      // 7. Cashback Terpending
      assert.ok(financeContentCode.includes('subTabTitle="Cashback Terpending"'), 'Cashback Terpending uses EnhancedTable');
    });
  });
});
