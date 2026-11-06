import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 1.1 — Task Acceptance UI Verification', () => {
  const messengerTaskCardPath = path.resolve('src/app/components/messenger/MessengerTaskCard.tsx');
  const messengerPoolTasksViewPath = path.resolve('src/app/components/messenger/MessengerPoolTasksView.tsx');
  const messengerMobileTaskDetailPath = path.resolve('src/app/components/messenger/MessengerMobileTaskDetail.tsx');

  const cardContent = fs.readFileSync(messengerTaskCardPath, 'utf8');
  const poolContent = fs.readFileSync(messengerPoolTasksViewPath, 'utf8');
  const detailContent = fs.readFileSync(messengerMobileTaskDetailPath, 'utf8');

  it('1. Non-clickable task card: outer Card container has NO onClick and NO cursor-pointer', () => {
    // MessengerTaskCard
    const cardContainerRegex = /<Card[\s\S]*?className=\{cn\([\s\S]*?\)\}[\s\S]*?>/;
    const cardMatch = cardContent.match(cardContainerRegex);
    assert.ok(cardMatch && cardMatch.length > 0, 'MessengerTaskCard must render <Card>');
    assert.strictEqual(
      cardMatch[0].includes('onClick'),
      false,
      'MessengerTaskCard outer <Card> must NOT have onClick handler'
    );
    assert.strictEqual(
      cardMatch[0].includes('cursor-pointer'),
      false,
      'MessengerTaskCard outer <Card> must NOT have cursor-pointer class'
    );

    // MessengerPoolTasksView
    const poolCardRegex = /<Card[\s\S]*?key=\{\`\$\{task\.orderNo\}-\$\{task\.keteranganTugas\}\`\}[\s\S]*?className=\{cn\([\s\S]*?\)\}[\s\S]*?>/;
    const poolCardMatch = poolContent.match(poolCardRegex);
    assert.ok(poolCardMatch && poolCardMatch.length > 0, 'MessengerPoolTasksView must render task <Card>');
    assert.strictEqual(
      poolCardMatch[0].includes('onClick'),
      false,
      'MessengerPoolTasksView task <Card> must NOT have onClick handler'
    );
    assert.strictEqual(
      poolCardMatch[0].includes('cursor-pointer'),
      false,
      'MessengerPoolTasksView outer <Card> must NOT have cursor-pointer class'
    );
  });

  it('2. Card action cleanup: NO "Terima Tugas", "Ambil Tugas", or "Tolak" in task card row', () => {
    // MessengerTaskCard footer
    const footerPendingSection = cardContent.substring(
      cardContent.indexOf('{isPendingAcceptance ?'),
      cardContent.indexOf(': (', cardContent.indexOf('{isPendingAcceptance ?'))
    );
    assert.ok(footerPendingSection, 'Must find isPendingAcceptance branch in MessengerTaskCard');
    assert.strictEqual(
      footerPendingSection.includes('Terima Tugas'),
      false,
      'Card pending footer must NOT have "Terima Tugas"'
    );
    assert.strictEqual(
      footerPendingSection.includes('Tolak'),
      false,
      'Card pending footer must NOT have "Tolak"'
    );
    assert.ok(
      footerPendingSection.includes('Lihat Tugas'),
      'Card pending footer MUST have explicit "Lihat Tugas" button'
    );
    assert.ok(
      footerPendingSection.includes('min-h-[48px]') || footerPendingSection.includes('h-12'),
      'Lihat Tugas button touch target must be >= 48px'
    );

    // MessengerPoolTasksView card actions row
    const poolActionsSection = poolContent.substring(
      poolContent.indexOf('{/* Actions row: Explicit Lihat Tugas with min-h-[48px], no inline acceptance */}'),
      poolContent.indexOf('</Card>', poolContent.indexOf('{/* Actions row: Explicit Lihat Tugas with min-h-[48px], no inline acceptance */}'))
    );
    assert.ok(poolActionsSection, 'Must find actions row in MessengerPoolTasksView');
    assert.strictEqual(
      poolActionsSection.includes('handleClaimTask'),
      false,
      'MessengerPoolTasksView card row must NOT call handleClaimTask directly'
    );
    assert.strictEqual(
      poolActionsSection.includes('handleOpenDeclineDialog'),
      false,
      'MessengerPoolTasksView card row must NOT call handleOpenDeclineDialog directly'
    );
    assert.ok(
      poolActionsSection.includes('Lihat Tugas & Persyaratan'),
      'MessengerPoolTasksView card row MUST have explicit "Lihat Tugas & Persyaratan" button'
    );
    assert.ok(
      poolActionsSection.includes('min-h-[48px]') && poolActionsSection.includes('h-12'),
      'MessengerPoolTasksView card button touch target must be >= 48px'
    );
  });

  it('3. Detail modal acceptance flow: acceptance buttons in detail modal with >= 48px touch target', () => {
    // MessengerPoolTasksView detail modal footer
    const poolModalFooter = poolContent.substring(
      poolContent.indexOf('{/* Sticky Footer with min-h-[48px] */}'),
      poolContent.indexOf('</DialogContent>', poolContent.indexOf('{/* Sticky Footer with min-h-[48px] */}'))
    );
    assert.ok(poolModalFooter, 'Must find detail modal footer in MessengerPoolTasksView');
    assert.ok(
      poolModalFooter.includes('Terima Tugas Ini') || poolModalFooter.includes('Ambil Tugas Ini'),
      'Detail modal footer MUST have "Terima Tugas Ini" / "Ambil Tugas Ini"'
    );
    assert.ok(
      poolModalFooter.includes('Tolak Tugas'),
      'Detail modal footer MUST have "Tolak Tugas" for pending tasks'
    );
    assert.ok(
      poolModalFooter.includes('min-h-[48px]') && poolModalFooter.includes('h-12'),
      'Detail modal action buttons touch target must be >= 48px'
    );

    // MessengerMobileTaskDetail sticky bottom action bar
    const detailStickyBar = detailContent.substring(
      detailContent.indexOf('{/* Sticky Bottom Actions Bar with touch target >= 48px */}'),
      detailContent.indexOf('</DialogContent>', detailContent.indexOf('{/* Sticky Bottom Actions Bar with touch target >= 48px */}'))
    );
    assert.ok(detailStickyBar, 'Must find sticky bottom actions bar in MessengerMobileTaskDetail');
    assert.ok(
      detailStickyBar.includes('Terima Tugas Ini'),
      'MessengerMobileTaskDetail MUST have "Terima Tugas Ini" button when pending'
    );
    assert.ok(
      detailStickyBar.includes('Tolak Tugas'),
      'MessengerMobileTaskDetail MUST have "Tolak Tugas" button when pending'
    );
    assert.ok(
      detailStickyBar.includes('min-h-[48px]') && detailStickyBar.includes('h-12'),
      'MessengerMobileTaskDetail action buttons touch target must be >= 48px'
    );
  });

  it('4. Dynamic service requirements integrated into detail views', () => {
    // MessengerPoolTasksView
    assert.ok(
      poolContent.includes('serviceStore.getServiceRequirementsDetail'),
      'MessengerPoolTasksView must call serviceStore.getServiceRequirementsDetail'
    );
    assert.ok(
      poolContent.includes('reqDetail.warningNotice'),
      'MessengerPoolTasksView must render warningNotice if present'
    );
    assert.ok(
      poolContent.includes('reqDetail.requirements'),
      'MessengerPoolTasksView must render dynamic requirements list'
    );

    // MessengerMobileTaskDetail
    assert.ok(
      detailContent.includes('serviceStore.getServiceRequirementsDetail'),
      'MessengerMobileTaskDetail must call serviceStore.getServiceRequirementsDetail'
    );
  });

  it('5. Conflict & error handling: HTTP 409 conflict handled gracefully with user notification', () => {
    assert.ok(
      poolContent.includes('isConflict') && poolContent.includes('Tugas ini sudah diambil'),
      'MessengerPoolTasksView must handle task conflict error explicitly'
    );
    assert.ok(
      detailContent.includes('isConflict') && detailContent.includes('Tugas ini sudah diambil'),
      'MessengerMobileTaskDetail must handle task conflict error explicitly'
    );
  });
});
