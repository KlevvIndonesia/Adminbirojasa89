const { execSync } = require('child_process');

const raw = execSync('git status --porcelain -uall', { encoding: 'utf8' });
const lines = raw.trim().split('\n').filter(Boolean);

console.log('Total git status entries:', lines.length);

const cats = {
  stepD_impl: [],
  stepD_tests: [],
  stepD_docs: [],
  stepC_impl: [],
  stepC_tests: [],
  stepC_docs: [],
  stepB_files: [],
  forensic_scripts: [],
  historical_deletions: [],
  historical_modifications: [],
  historical_tests: [],
  historical_docs: [],
  unexplained: [],
};

const stepDImplFiles = new Set([
  'server/src/utils/dateNormalizer.ts',
  'server/src/app.ts',
  'server/src/server.ts',
]);

const stepDTestFiles = new Set([
  'tests/date-normalizer.test.ts',
  'tests/phase4b-batch2b-stepD-startup-backfill-safety.test.ts',
]);

const stepCImplFiles = new Set([
  'server/src/repositories/dbFinanceRepository.ts',
  'server/src/services/financeService.ts',
  'server/src/services/orderService.ts',
  'server/src/controllers/financeController.ts',
  'server/src/controllers/orderController.ts',
  'server/src/routes/financeRoutes.ts',
]);

const stepBFiles = new Set([
  'server/src/database/schema.ts',
  'server/src/utils/canonicalHasher.ts',
  'src/domain/order/types.ts',
  'tests/phase4b-batch2b-stepB-payment-identity.test.ts',
  'docs/audits/PHASE_4B_BATCH_2B_STEP_B_PAYMENT_IDENTITY_AUDIT.md',
  'docs/audits/PHASE_4B_BATCH_2B_STEP_B_IMPLEMENTATION_REPORT.md',
  'docs/audits/PHASE_4B_BATCH_2B_STEP_B_FINAL_RECONCILIATION.md',
  'docs/audits/PHASE_4B_BATCH_2B_STEP_B_FINAL_SCOPE_VERIFICATION.md',
]);

lines.forEach(line => {
  const status = line.substring(0, 2);
  const file = line.substring(3).trim();

  if (stepDImplFiles.has(file)) {
    cats.stepD_impl.push({ status, file });
  } else if (stepDTestFiles.has(file)) {
    cats.stepD_tests.push({ status, file });
  } else if (file.includes('STEP_D')) {
    cats.stepD_docs.push({ status, file });
  } else if (stepCImplFiles.has(file)) {
    cats.stepC_impl.push({ status, file });
  } else if (file === 'tests/phase4b-batch2b-stepC-payment-lifecycle.test.ts') {
    cats.stepC_tests.push({ status, file });
  } else if (file.includes('STEP_C')) {
    cats.stepC_docs.push({ status, file });
  } else if (stepBFiles.has(file)) {
    cats.stepB_files.push({ status, file });
  } else if (file.startsWith('scripts/')) {
    cats.forensic_scripts.push({ status, file });
  } else if (status === ' D' || status === 'D ') {
    cats.historical_deletions.push({ status, file });
  } else if (file.startsWith('tests/') || file.startsWith('e2e/')) {
    cats.historical_tests.push({ status, file });
  } else if (file.startsWith('docs/')) {
    cats.historical_docs.push({ status, file });
  } else if (status === ' M' || status === 'M ') {
    cats.historical_modifications.push({ status, file });
  } else if (
    file.startsWith('server/src/database/migrations/') ||
    file === 'server/src/services/canonicalInvoiceCalculator.ts' ||
    file === 'server/src/utils/timestampSerializer.ts'
  ) {
    cats.historical_modifications.push({ status, file });
  } else {
    cats.unexplained.push({ status, file });
  }
});

console.log('1. Step D Implementation:', cats.stepD_impl.length);
cats.stepD_impl.forEach(f => console.log('   -', f.file));
console.log('2. Step D Tests:', cats.stepD_tests.length);
cats.stepD_tests.forEach(f => console.log('   -', f.file));
console.log('3. Step D Docs:', cats.stepD_docs.length);
cats.stepD_docs.forEach(f => console.log('   -', f.file));
console.log('4. Step C Implementation:', cats.stepC_impl.length);
cats.stepC_impl.forEach(f => console.log('   -', f.file));
console.log('5. Step C Tests:', cats.stepC_tests.length);
cats.stepC_tests.forEach(f => console.log('   -', f.file));
console.log('6. Step C Docs:', cats.stepC_docs.length);
cats.stepC_docs.forEach(f => console.log('   -', f.file));
console.log('7. Step B Files:', cats.stepB_files.length);
console.log('8. Forensic & Runner Scripts in scripts/:', cats.forensic_scripts.length);
console.log('9. Historical Deletions (Phase 1 legacy/mock/stubs):', cats.historical_deletions.length);
console.log('10. Historical Modifications (Phases 1-4A):', cats.historical_modifications.length);
console.log('11. Historical Tests (Phases 1-4B Batch 1):', cats.historical_tests.length);
console.log('12. Historical Docs (Phases 1-4B Batch 1):', cats.historical_docs.length);
console.log('13. Unexplained:', cats.unexplained.length);
if (cats.unexplained.length > 0) {
  cats.unexplained.forEach(f => console.log('   [UNEXPLAINED]', f.file));
}

const sum = cats.stepD_impl.length + cats.stepD_tests.length + cats.stepD_docs.length + cats.stepC_impl.length + cats.stepC_tests.length + cats.stepC_docs.length + cats.stepB_files.length + cats.forensic_scripts.length + cats.historical_deletions.length + cats.historical_modifications.length + cats.historical_tests.length + cats.historical_docs.length + cats.unexplained.length;
console.log(`\nVerification: Sum = ${sum}, Total = ${lines.length}, Unexplained = ${cats.unexplained.length}`);
