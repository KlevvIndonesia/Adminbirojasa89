const { execSync } = require('child_process');
const fs = require('fs');

const raw = execSync('git status --porcelain -uall', { encoding: 'utf8' });
const lines = raw.trim().split('\n').filter(Boolean);

console.log('Total git entries:', lines.length);

const categories = {
  stepC_impl: [],
  stepC_test: [],
  stepC_docs: [],
  forensic_scripts: [],
  historical: [],
  unexplained: [],
};

lines.forEach(line => {
  const status = line.substring(0, 2);
  const file = line.substring(3).trim();

  // Step C Implementation files
  if (
    file === 'server/src/repositories/dbFinanceRepository.ts' ||
    file === 'server/src/services/financeService.ts' ||
    file === 'server/src/services/orderService.ts' ||
    file === 'server/src/controllers/financeController.ts' ||
    file === 'server/src/controllers/orderController.ts' ||
    file === 'server/src/routes/financeRoutes.ts'
  ) {
    categories.stepC_impl.push({ status, file });
  } else if (file === 'tests/phase4b-batch2b-stepC-payment-lifecycle.test.ts') {
    categories.stepC_test.push({ status, file });
  } else if (
    file === 'docs/audits/PHASE_4B_BATCH_2B_STEP_C_IMPLEMENTATION_REPORT.md' ||
    file.includes('STEP_C')
  ) {
    categories.stepC_docs.push({ status, file });
  } else if (
    file.startsWith('scripts/compare_') ||
    file.startsWith('scripts/verify_') ||
    file.startsWith('scripts/fix_') ||
    file.startsWith('scripts/run-test-') ||
    file.startsWith('scripts/run-') ||
    file.startsWith('scripts/patch-')
  ) {
    categories.forensic_scripts.push({ status, file });
  } else {
    // Check if it's historical / previous phases
    categories.historical.push({ status, file });
  }
});

console.log('\n--- CATEGORY BREAKDOWN ---');
console.log('Step C Implementation files:', categories.stepC_impl.length);
categories.stepC_impl.forEach(f => console.log(`  [${f.status}] ${f.file}`));

console.log('Step C Test files:', categories.stepC_test.length);
categories.stepC_test.forEach(f => console.log(`  [${f.status}] ${f.file}`));

console.log('Step C Documentation files:', categories.stepC_docs.length);
categories.stepC_docs.forEach(f => console.log(`  [${f.status}] ${f.file}`));

console.log('Forensic / test runner scripts:', categories.forensic_scripts.length);
console.log('Historical / previous phases:', categories.historical.length);
console.log('Unexplained:', categories.unexplained.length);

const sum = categories.stepC_impl.length + categories.stepC_test.length + categories.stepC_docs.length + categories.forensic_scripts.length + categories.historical.length + categories.unexplained.length;
console.log('Sum check:', sum, '=== Total:', lines.length);
