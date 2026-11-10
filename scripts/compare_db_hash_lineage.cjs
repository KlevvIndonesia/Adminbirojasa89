const { DatabaseSync } = require('node:sqlite');

const dbB = new DatabaseSync('server/backups/database_phase4b_stepB_pre_migration.sqlite', { readOnly: true });
const dbC = new DatabaseSync('server/backups/database_phase4b_stepC_pre_implementation.sqlite', { readOnly: true });
const dbOp = new DatabaseSync('server/data/database.sqlite', { readOnly: true });

console.log('=== FORENSIC DATABASE COMPARISON ===');

const tablesB = dbB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
const tablesC = dbC.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
const tablesOp = dbOp.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);

console.log(`Table Count: B=${tablesB.length}, C=${tablesC.length}, Op=${tablesOp.length}`);

// Compare Row Counts across all 41 tables
let hasDataDiff = false;
for (const table of tablesB) {
  const cB = dbB.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
  const cC = dbC.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
  const cOp = dbOp.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
  if (cB !== cC || cC !== cOp) {
    console.log(`[DATA DIFF] Table ${table}: B=${cB}, C=${cC}, Op=${cOp}`);
    hasDataDiff = true;
  }
}
if (!hasDataDiff) {
  console.log('Row counts across ALL 41 user tables are 100% IDENTICAL across B, C, and Op!');
}

// Compare Schemas
console.log('\n--- SCHEMA COMPARISON ---');
for (const table of tablesB) {
  const schemaB = dbB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(table)?.sql;
  const schemaC = dbC.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(table)?.sql;
  if (schemaB !== schemaC) {
    console.log(`[SCHEMA DIFF] Table ${table}:`);
    console.log(`  B: ${schemaB}`);
    console.log(`  C: ${schemaC}`);
  }
}

// Compare Indexes
console.log('\n--- INDEX COMPARISON ---');
const idxB = dbB.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all();
const idxC = dbC.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all();
const idxBMap = new Map(idxB.map(i => [i.name, i.sql]));
const idxCMap = new Map(idxC.map(i => [i.name, i.sql]));

for (const [name, sql] of idxCMap.entries()) {
  if (!idxBMap.has(name)) {
    console.log(`[NEW INDEX IN C] ${name}: ${sql}`);
  }
}
for (const [name, sql] of idxBMap.entries()) {
  if (!idxCMap.has(name)) {
    console.log(`[REMOVED INDEX IN C] ${name}: ${sql}`);
  }
}

// Check PRAGMA values (schema_version, user_version, freereelist)
console.log('\n--- PRAGMA COMPARISON ---');
['schema_version', 'user_version', 'freelist_count', 'page_count', 'page_size'].forEach(p => {
  const vB = dbB.prepare(`PRAGMA ${p}`).get()[p];
  const vC = dbC.prepare(`PRAGMA ${p}`).get()[p];
  const vOp = dbOp.prepare(`PRAGMA ${p}`).get()[p];
  console.log(`PRAGMA ${p}: B=${vB}, C=${vC}, Op=${vOp}`);
});

// Compare invoice_payments rows
console.log('\n--- INVOICE_PAYMENTS ROW COMPARISON (ID 1-7) ---');
const rowsB = dbB.prepare("SELECT * FROM invoice_payments ORDER BY id").all();
const rowsC = dbC.prepare("SELECT * FROM invoice_payments ORDER BY id").all();
console.log(`Rows count: B=${rowsB.length}, C=${rowsC.length}`);
rowsC.forEach((rC, idx) => {
  const rB = rowsB[idx];
  console.log(`ID ${rC.id}: nominal=${rC.nominal}, status=${rC.status_verifikasi}, payment_id=${rC.payment_id}, kas_kantor_id=${rC.kas_kantor_id}`);
});

dbB.close();
dbC.close();
dbOp.close();
