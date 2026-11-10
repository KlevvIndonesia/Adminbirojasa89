const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadDir = 'server/uploads';
const files = fs.readdirSync(uploadDir).sort();

console.log('=== UPLOADS CANONICAL MANIFEST VERIFICATION ===');
console.log('Total files found:', files.length);

let totalBytes = 0;
const fileEntries = [];

files.forEach(file => {
  const filePath = path.join(uploadDir, file);
  const stat = fs.statSync(filePath);
  totalBytes += stat.size;
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
  fileEntries.push({
    rel: file,
    size: stat.size,
    sha256: hash
  });
});

console.log('Total size (bytes):', totalBytes);

// Canonical formula from PHASE_4B_BATCH_2B_STEP_B_FINAL_RECONCILIATION.md
const manifest = fileEntries.map(f => `${f.rel}|${f.size}|${f.sha256.toUpperCase()}`).join('\n');
const computedHash = crypto.createHash('sha256').update(manifest).digest('hex').toUpperCase();

console.log('Computed Canonical SHA-256:', computedHash);
console.log('Approved Baseline Hash:     4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5');

if (computedHash === '4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5') {
  console.log('STATUS: EXACT 100% MATCH - ALL 51 FILES VERIFIED INTACT');
} else {
  console.log('STATUS: MISMATCH');
}
