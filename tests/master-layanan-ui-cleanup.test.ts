import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('MASTER LAYANAN — UI CLEANUP Verification Suite', () => {
  const masterLayananPath = path.resolve('src/app/components/MasterLayanan.tsx');
  const designTokensPath = path.resolve('src/styles/design-tokens.css');
  const appPath = path.resolve('src/app/App.tsx');
  const masterDataPath = path.resolve('src/app/components/MasterData.tsx');
  const masterDataContentPath = path.resolve('src/app/components/MasterDataContent.tsx');

  const masterLayananCode = fs.readFileSync(masterLayananPath, 'utf8');
  const designTokensCode = fs.readFileSync(designTokensPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const masterDataCode = fs.readFileSync(masterDataPath, 'utf8');
  const masterDataContentCode = fs.readFileSync(masterDataContentPath, 'utf8');

  it('1. Redundant page heading and description are removed', () => {
    // Assert heading text is removed
    assert.strictEqual(
      masterLayananCode.includes('Master Layanan & Persyaratan Dokumen'),
      false,
      'Internal redundant heading "Master Layanan & Persyaratan Dokumen" must be removed'
    );
    // Assert description text is removed
    assert.strictEqual(
      masterLayananCode.includes('Katalog master pengurusan Samsat, deskripsi resmi, dan daftar dokumen prasyarat yang wajib disiapkan pelanggan.'),
      false,
      'Internal redundant description must be removed'
    );
    // Assert Layers icon is removed from MasterLayanan
    assert.strictEqual(
      masterLayananCode.includes('<Layers'),
      false,
      'Redundant Layers icon must be removed'
    );
  });

  it('2. Service count and Segarkan button are preserved and cleanly repositioned', () => {
    // Service count badge
    assert.ok(
      masterLayananCode.includes('{services.length} Layanan'),
      'Must retain service count badge info'
    );
    // Segarkan button
    assert.ok(
      masterLayananCode.includes('Segarkan'),
      'Must retain Segarkan button'
    );
    assert.ok(
      masterLayananCode.includes('refreshServices()'),
      'Must retain refreshServices trigger'
    );
    assert.ok(
      masterLayananCode.includes('RefreshCw'),
      'Must retain RefreshCw icon'
    );
    // Repositioned toolbar
    assert.ok(
      masterLayananCode.includes('flex items-center justify-between gap-3'),
      'Must arrange service count and Segarkan button in a clean flex toolbar'
    );
  });

  it('3. All service cards, information, and Edit Layanan functionality are intact', () => {
    // Service cards mapping
    assert.ok(
      masterLayananCode.includes('sortedServices.map((svc) =>'),
      'Must retain mapping of sorted services'
    );
    // Service info
    assert.ok(
      masterLayananCode.includes('svc.nama_layanan'),
      'Must display service name'
    );
    assert.ok(
      masterLayananCode.includes('svc.kode_layanan'),
      'Must display service code'
    );
    assert.ok(
      masterLayananCode.includes('svc.requirements'),
      'Must display requirements list'
    );
    // Edit dialog & button
    assert.ok(
      masterLayananCode.includes('Edit Layanan'),
      'Must retain Edit Layanan button'
    );
    assert.ok(
      masterLayananCode.includes('handleOpenEdit'),
      'Must retain edit dialog opener'
    );
    assert.ok(
      masterLayananCode.includes('handleSave'),
      'Must retain save handler'
    );
  });

  it('4. Horizontal spacing and container convention are normalized', () => {
    // MasterLayanan uses standard shared layout convention
    assert.ok(
      masterLayananCode.includes('flex-1 flex flex-col min-h-0 space-y-4 w-full min-w-0'),
      'MasterLayanan must adopt shared container convention matching other Master Data views'
    );

    // Responsive grid is maintained without arbitrary hardcoded offsets
    assert.ok(
      masterLayananCode.includes('grid grid-cols-1 md:grid-cols-2 gap-4'),
      'Grid cards must remain proportional across desktop and tablet/mobile breakpoints'
    );

    // Canonical page-shell in design-tokens.css matches header and breadcrumb padding
    assert.ok(
      designTokensCode.includes('padding: 0.75rem; /* 12px mobile (matches px-3) */'),
      'Page-shell mobile padding must match px-3 (12px)'
    );
    assert.ok(
      designTokensCode.includes('padding: 1rem; /* 16px tablet sm (matches sm:px-4) */'),
      'Page-shell sm padding must match sm:px-4 (16px)'
    );
    assert.ok(
      designTokensCode.includes('padding: 1.5rem; /* 24px tablet md & desktop (matches md:px-6) */'),
      'Page-shell md/desktop padding must match md:px-6 (24px)'
    );
  });

  it('5. MasterData and MasterDataContent route integration remains clean', () => {
    assert.ok(
      masterDataCode.includes('content-fluid'),
      'MasterData container must use content-fluid'
    );
    assert.ok(
      masterDataContentCode.includes('if (tab === "layanan") return <MasterLayanan />;'),
      'MasterDataContent must route tab "layanan" to MasterLayanan'
    );
  });
});
