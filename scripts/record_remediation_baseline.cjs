const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

console.log('=== PRE-REMEDIATION BASELINE AUDIT ===');
const opBuf = fs.readFileSync('server/data/database.sqlite');
const dbHash = crypto.createHash('sha256').update(opBuf).digest('hex').toUpperCase();
console.log(`Database Size: ${opBuf.length} bytes`);
console.log(`Database SHA-256: ${dbHash}`);

const db = new DatabaseSync('server/data/database.sqlite', { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log(`User Tables: ${tables.length}`);

let totalRows = 0;
tables.forEach(t => {
  const c = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  totalRows += c;
});
console.log(`Total Rows across all tables: ${totalRows}`);

const payRows = db.prepare("SELECT id, invoice_no, order_no, nominal, status_verifikasi, payment_id, kas_kantor_id FROM invoice_payments ORDER BY id").all();
console.log('Historical invoice_payments:');
payRows.forEach(r => {
  console.log(`  ID ${r.id}: ${r.order_no} | ${r.nominal} | ${r.status_verifikasi} | payment_id=${r.payment_id} | kas_kantor_id=${r.kas_kantor_id}`);
});
db.close();

// Uploads manifest
const uploadDir = 'server/uploads';
const files = fs.readdirSync(uploadDir).sort();
let uploadBytes = 0;
const fileEntries = [];
files.forEach(f => {
  const stat = fs.statSync(`${uploadDir}/${f}`);
  uploadBytes += stat.size;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(`${uploadDir}/${f}`)).digest('hex').toUpperCase();
  fileEntries.push(`${f}|${stat.size}|${hash}`);
});
const manifestStr = fileEntries.join('\n');
const uploadManifestHash = crypto.createHash('sha256').update(manifestStr).digest('hex').toUpperCase();
console.log(`Uploads Count: ${files.length}`);
console.log(`Uploads Total Size: ${uploadBytes} bytes`);
console.log(`Uploads Manifest SHA-256: ${uploadManifestHash}`);
