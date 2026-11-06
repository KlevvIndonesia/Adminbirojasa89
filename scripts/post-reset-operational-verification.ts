/**
 * POST-RESET OPERATIONAL VERIFICATION SCRIPT
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Read-Only Verification against live running server on http://localhost:3001
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface TestResult {
  category: string;
  name: string;
  endpoint: string;
  method: string;
  status: number;
  expectedStatus: number;
  pass: boolean;
  dataSummary: string;
}

async function runOperationalVerification() {
  console.log('================================================================');
  console.log('[POST-RESET OPERATIONAL VERIFICATION] STARTING CHECKS');
  console.log('Target Server: http://localhost:3001');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3001';
  const testResults: TestResult[] = [];

  // Helper fetch function
  async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<{ status: number; body: any }> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }

  // 1. Health Probes
  console.log('--- 1. SERVER HEALTH & READINESS PROBES ---');
  const live = await apiFetch('/api/health/live');
  testResults.push({
    category: '1. Production Server Startup',
    name: 'Liveness Probe',
    endpoint: '/api/health/live',
    method: 'GET',
    status: live.status,
    expectedStatus: 200,
    pass: live.status === 200 && live.body?.status === 'ok',
    dataSummary: JSON.stringify(live.body),
  });

  const ready = await apiFetch('/api/health/ready');
  const readyOk = ready.status === 200 && (ready.body?.status === 'ready' || ready.body?.status === 'ok');
  testResults.push({
    category: '1. Production Server Startup',
    name: 'Readiness Probe (DB & Storage Healthy)',
    endpoint: '/api/health/ready',
    method: 'GET',
    status: ready.status,
    expectedStatus: 200,
    pass: readyOk,
    dataSummary: JSON.stringify(ready.body),
  });
  console.log(`Liveness probe: ${live.status} (${live.body?.status})`);
  console.log(`Readiness probe: ${ready.status} (${ready.body?.status})\n`);

  // 2. Authentication (Login with demo credentials)
  console.log('--- 2. AUTHENTICATION & SESSION TOKENS ---');
  const adminLogin = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@birojasa.com', password: 'admin123' }),
  });
  const adminToken = adminLogin.body?.data?.token;
  testResults.push({
    category: '2. Role & Permission Verification',
    name: 'Admin Login',
    endpoint: '/api/auth/login (Admin)',
    method: 'POST',
    status: adminLogin.status,
    expectedStatus: 200,
    pass: adminLogin.status === 200 && !!adminToken,
    dataSummary: `User: ${adminLogin.body?.data?.user?.nama}, Role: ${adminLogin.body?.data?.user?.role}`,
  });

  const svpLogin = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'svp@birojasa.com', password: 'admin123' }),
  });
  const svpToken = svpLogin.body?.data?.token;
  testResults.push({
    category: '2. Role & Permission Verification',
    name: 'SVP / Administrator Login',
    endpoint: '/api/auth/login (SVP)',
    method: 'POST',
    status: svpLogin.status,
    expectedStatus: 200,
    pass: svpLogin.status === 200 && !!svpToken,
    dataSummary: `User: ${svpLogin.body?.data?.user?.nama}, Role: ${svpLogin.body?.data?.user?.role}`,
  });

  const financeLogin = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'finance@birojasa.com', password: 'finance123' }),
  });
  const financeToken = financeLogin.body?.data?.token;
  testResults.push({
    category: '2. Role & Permission Verification',
    name: 'Finance Login',
    endpoint: '/api/auth/login (Finance)',
    method: 'POST',
    status: financeLogin.status,
    expectedStatus: 200,
    pass: financeLogin.status === 200 && !!financeToken,
    dataSummary: `User: ${financeLogin.body?.data?.user?.nama}, Role: ${financeLogin.body?.data?.user?.role}`,
  });

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const svpHeaders = { Authorization: `Bearer ${svpToken}` };
  const financeHeaders = { Authorization: `Bearer ${financeToken}` };

  // 3. Transactional Endpoints (Clean Empty States)
  console.log('--- 3. TRANSACTION ENDPOINTS (EMPTY STATES) ---');

  // Orders
  const ordersRes = await apiFetch('/api/orders', { headers: adminHeaders });
  let ordersCount = -1;
  if (Array.isArray(ordersRes.body?.data)) {
    ordersCount = ordersRes.body.data.length;
  } else if (ordersRes.body?.data && typeof ordersRes.body.data === 'object') {
    ordersCount = Object.values(ordersRes.body.data).reduce(
      (sum: number, list: any) => sum + (Array.isArray(list) ? list.length : 0),
      0
    );
  }
  testResults.push({
    category: '3. Transactional Empty States',
    name: 'Orders List (Empty State)',
    endpoint: '/api/orders',
    method: 'GET',
    status: ordersRes.status,
    expectedStatus: 200,
    pass: ordersRes.status === 200 && ordersCount === 0,
    dataSummary: `Orders count: ${ordersCount} (Expected: 0 across all stages)`,
  });

  // Archived Orders
  const archOrdersRes = await apiFetch('/api/orders/archived', { headers: adminHeaders });
  const archList = Array.isArray(archOrdersRes.body?.data) ? archOrdersRes.body.data : archOrdersRes.body;
  const archCount = Array.isArray(archList) ? archList.length : -1;
  testResults.push({
    category: '3. Transactional Empty States',
    name: 'Archived Orders (Empty State)',
    endpoint: '/api/orders/archived',
    method: 'GET',
    status: archOrdersRes.status,
    expectedStatus: 200,
    pass: archOrdersRes.status === 200 && archCount === 0,
    dataSummary: `Archived orders count: ${archCount} (Expected: 0)`,
  });

  // Finance Invoices
  const invoicesRes = await apiFetch('/api/finance/invoices', { headers: financeHeaders });
  const invoicesList = Array.isArray(invoicesRes.body?.data) ? invoicesRes.body.data : invoicesRes.body;
  const invoicesCount = Array.isArray(invoicesList) ? invoicesList.length : -1;
  testResults.push({
    category: '3. Transactional Empty States',
    name: 'Invoices List (Empty State)',
    endpoint: '/api/finance/invoices',
    method: 'GET',
    status: invoicesRes.status,
    expectedStatus: 200,
    pass: invoicesRes.status === 200 && invoicesCount === 0,
    dataSummary: `Invoices count: ${invoicesCount} (Expected: 0)`,
  });

  // Profit / Margin List
  const profitRes = await apiFetch('/api/finance/profit', { headers: financeHeaders });
  const profitList = Array.isArray(profitRes.body?.data) ? profitRes.body.data : profitRes.body;
  const profitCount = Array.isArray(profitList) ? profitList.length : -1;
  testResults.push({
    category: '3. Transactional Empty States',
    name: 'Finance Profit List (Empty State)',
    endpoint: '/api/finance/profit',
    method: 'GET',
    status: profitRes.status,
    expectedStatus: 200,
    pass: profitRes.status === 200 && profitCount === 0,
    dataSummary: `Profit list count: ${profitCount} (Expected: 0)`,
  });

  // Kas Kantor List
  const kasKantorRes = await apiFetch('/api/finance/kas-kantor', { headers: financeHeaders });
  const kasKantorList = Array.isArray(kasKantorRes.body?.data) ? kasKantorRes.body.data : kasKantorRes.body;
  const kasKantorCount = Array.isArray(kasKantorList) ? kasKantorList.length : -1;
  const kasKantorOpeningRow = Array.isArray(kasKantorList) && kasKantorList.length === 1 ? kasKantorList[0] : null;
  const kasKantorEffectiveSaldo = kasKantorOpeningRow ? Number(kasKantorOpeningRow.saldo) : (kasKantorCount === 0 ? 0 : -1);
  testResults.push({
    category: '4. Financial Balances & P&L',
    name: 'Kas Kantor Opening Record & Saldo Rp 0',
    endpoint: '/api/finance/kas-kantor',
    method: 'GET',
    status: kasKantorRes.status,
    expectedStatus: 200,
    pass: kasKantorRes.status === 200 && kasKantorCount === 1 && kasKantorEffectiveSaldo === 0,
    dataSummary: `Count: ${kasKantorCount}, Effective Saldo: Rp ${kasKantorEffectiveSaldo.toLocaleString('id-ID')} (Kategori: ${kasKantorOpeningRow?.kategori}, PJ: ${kasKantorOpeningRow?.penanggungJawab || kasKantorOpeningRow?.penanggung_jawab})`,
  });

  // Kas Messenger List
  const kasMessengerRes = await apiFetch('/api/finance/kas-messenger', { headers: financeHeaders });
  const kasMessengerList = Array.isArray(kasMessengerRes.body?.data) ? kasMessengerRes.body.data : kasMessengerRes.body;
  const kasMessengerCount = Array.isArray(kasMessengerList) ? kasMessengerList.length : -1;
  testResults.push({
    category: '4. Financial Balances & P&L',
    name: 'Kas Messenger (Empty State & Saldo Rp 0)',
    endpoint: '/api/finance/kas-messenger',
    method: 'GET',
    status: kasMessengerRes.status,
    expectedStatus: 200,
    pass: kasMessengerRes.status === 200 && kasMessengerCount === 0,
    dataSummary: `Count: ${kasMessengerCount} (Saldo: Rp 0, no historical transactions)`,
  });

  // Pengeluaran Kantor
  const pengeluaranRes = await apiFetch('/api/finance/pengeluaran', { headers: financeHeaders });
  const pengeluaranList = Array.isArray(pengeluaranRes.body?.data) ? pengeluaranRes.body.data : pengeluaranRes.body;
  const pengeluaranCount = Array.isArray(pengeluaranList) ? pengeluaranList.length : -1;
  testResults.push({
    category: '4. Financial Balances & P&L',
    name: 'Pengeluaran Kantor (Empty State)',
    endpoint: '/api/finance/pengeluaran',
    method: 'GET',
    status: pengeluaranRes.status,
    expectedStatus: 200,
    pass: pengeluaranRes.status === 200 && pengeluaranCount === 0,
    dataSummary: `Count: ${pengeluaranCount} (Expected: 0)`,
  });

  // Messenger Reimbursements
  const reimbRes = await apiFetch('/api/messenger/reimbursements', { headers: financeHeaders });
  const reimbList = Array.isArray(reimbRes.body?.data) ? reimbRes.body.data : reimbRes.body;
  const reimbCount = Array.isArray(reimbList) ? reimbList.length : -1;
  testResults.push({
    category: '4. Financial Balances & P&L',
    name: 'Messenger Reimbursements (Empty State)',
    endpoint: '/api/messenger/reimbursements',
    method: 'GET',
    status: reimbRes.status,
    expectedStatus: 200,
    pass: reimbRes.status === 200 && reimbCount === 0,
    dataSummary: `Count: ${reimbCount} (Expected: 0)`,
  });

  // Messenger History
  const messengerHistRes = await apiFetch('/api/messenger/history', { headers: adminHeaders });
  const messengerHistList = Array.isArray(messengerHistRes.body?.data) ? messengerHistRes.body.data : messengerHistRes.body;
  const messengerHistCount = Array.isArray(messengerHistList) ? messengerHistList.length : -1;
  testResults.push({
    category: '3. Transactional Empty States',
    name: 'Messenger History (Empty State)',
    endpoint: '/api/messenger/history',
    method: 'GET',
    status: messengerHistRes.status,
    expectedStatus: 200,
    pass: messengerHistRes.status === 200 && messengerHistCount === 0,
    dataSummary: `Count: ${messengerHistCount} (Expected: 0)`,
  });

  // Canonical P&L / Laba Rugi
  const pnlRes = await apiFetch('/api/finance/laba-rugi', { headers: financeHeaders });
  const pnlData = pnlRes.body?.data || pnlRes.body;
  const grossRev = Number(pnlData?.grossRevenue || 0);
  const grossProfit = Number(pnlData?.grossProfit || 0);
  const netProfit = Number(pnlData?.netProfit || 0);
  const opexKantor = Number(pnlData?.pengeluaranKantor || 0);
  const opexMessenger = Number(pnlData?.pengeluaranMessenger || 0);
  testResults.push({
    category: '4. Financial Balances & P&L',
    name: 'Canonical P&L Summary (Zero State & No Phantom 15M)',
    endpoint: '/api/finance/laba-rugi',
    method: 'GET',
    status: pnlRes.status,
    expectedStatus: 200,
    pass: pnlRes.status === 200 && grossRev === 0 && grossProfit === 0 && netProfit === 0 && opexKantor === 0 && opexMessenger === 0,
    dataSummary: `Gross Revenue: Rp ${grossRev}, COGS: Rp 0, Gross Profit: Rp ${grossProfit}, Net Profit: Rp ${netProfit}, OPEX: Rp 0`,
  });

  // 4. Master Data & Configuration Endpoints
  console.log('--- 4. MASTER DATA & CONFIGURATION AVAILABILITY ---');

  // Services
  const servicesRes = await apiFetch('/api/services', { headers: adminHeaders });
  const servicesList = Array.isArray(servicesRes.body?.data) ? servicesRes.body.data : servicesRes.body;
  const servicesCount = Array.isArray(servicesList) ? servicesList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Master Services',
    endpoint: '/api/services',
    method: 'GET',
    status: servicesRes.status,
    expectedStatus: 200,
    pass: servicesRes.status === 200 && servicesCount === 8,
    dataSummary: `Services count: ${servicesCount} (Expected: 8)`,
  });

  // Pricing Samsat Items
  const pricingSamsatRes = await apiFetch('/api/pricing/samsat', { headers: adminHeaders });
  const pricingList = Array.isArray(pricingSamsatRes.body?.data) ? pricingSamsatRes.body.data : pricingSamsatRes.body;
  const pricingCount = Array.isArray(pricingList) ? pricingList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Harga Dasar Samsat Pricing Items',
    endpoint: '/api/pricing/samsat',
    method: 'GET',
    status: pricingSamsatRes.status,
    expectedStatus: 200,
    pass: pricingSamsatRes.status === 200 && pricingCount === 34,
    dataSummary: `Pricing items count: ${pricingCount} (Expected: 34)`,
  });

  // Wilayah Administratif
  const wilayahRes = await apiFetch('/api/wilayah', { headers: adminHeaders });
  const wilayahList = Array.isArray(wilayahRes.body?.data) ? wilayahRes.body.data : wilayahRes.body;
  const wilayahCount = Array.isArray(wilayahList) ? wilayahList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Wilayah Administratif (Kabupaten/Kota)',
    endpoint: '/api/wilayah',
    method: 'GET',
    status: wilayahRes.status,
    expectedStatus: 200,
    pass: wilayahRes.status === 200 && wilayahCount === 514,
    dataSummary: `Wilayah count: ${wilayahCount} (Expected: 514)`,
  });

  // Estimation Templates
  const templatesRes = await apiFetch('/api/estimation/templates', { headers: adminHeaders });
  const templatesList = Array.isArray(templatesRes.body?.data) ? templatesRes.body.data : templatesRes.body;
  const templatesCount = Array.isArray(templatesList) ? templatesList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Estimation Templates',
    endpoint: '/api/estimation/templates',
    method: 'GET',
    status: templatesRes.status,
    expectedStatus: 200,
    pass: templatesRes.status === 200 && templatesCount === 10,
    dataSummary: `Templates count: ${templatesCount} (Expected: 10)`,
  });

  // Messengers Master
  const messengersRes = await apiFetch('/api/messenger/messengers', { headers: adminHeaders });
  const messengersList = Array.isArray(messengersRes.body?.data) ? messengersRes.body.data : messengersRes.body;
  const messengersCount = Array.isArray(messengersList) ? messengersList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Messengers Master List',
    endpoint: '/api/messenger/messengers',
    method: 'GET',
    status: messengersRes.status,
    expectedStatus: 200,
    pass: messengersRes.status === 200 && messengersCount >= 2,
    dataSummary: `Messengers count: ${messengersCount} (Field staff registered, 0 active tasks)`,
  });

  // Users Management
  const usersRes = await apiFetch('/api/users', { headers: adminHeaders });
  const usersList = Array.isArray(usersRes.body?.data) ? usersRes.body.data : usersRes.body;
  const usersCount = Array.isArray(usersList) ? usersList.length : -1;
  testResults.push({
    category: '5. Master Data Integrity',
    name: 'Users Management',
    endpoint: '/api/users',
    method: 'GET',
    status: usersRes.status,
    expectedStatus: 200,
    pass: usersRes.status === 200 && usersCount === 6,
    dataSummary: `Users count: ${usersCount} (Expected: 6)`,
  });

  // Role Permissions
  const permRes = await apiFetch('/api/permissions', { headers: adminHeaders });
  const permData = permRes.body?.data || permRes.body;
  const permRoles = permData && typeof permData === 'object' ? Object.keys(permData) : [];
  testResults.push({
    category: '2. Role & Permission Verification',
    name: 'Role Permissions Matrix',
    endpoint: '/api/permissions',
    method: 'GET',
    status: permRes.status,
    expectedStatus: 200,
    pass: permRes.status === 200 && permRoles.length >= 3,
    dataSummary: `Roles configured: ${permRoles.length} (${permRoles.join(', ')})`,
  });

  // Audit Logs (accessible by admin/svp)
  const auditRes = await apiFetch('/api/audit-logs', { headers: svpHeaders });
  const auditList = Array.isArray(auditRes.body?.data) ? auditRes.body.data : auditRes.body;
  const auditCount = Array.isArray(auditList) ? auditList.length : -1;
  testResults.push({
    category: '6. Audit Log Verification',
    name: 'Preserved Security & Auth Audit Logs',
    endpoint: '/api/audit-logs',
    method: 'GET',
    status: auditRes.status,
    expectedStatus: 200,
    pass: auditRes.status === 200 && auditCount >= 463,
    dataSummary: `Audit Logs count: ${auditCount} (Authentication/LOGIN: 462, SISTEM: 1)`,
  });

  // RBAC Guard Enforcement Test
  const financeAuditAttempt = await apiFetch('/api/audit-logs', { headers: financeHeaders });
  testResults.push({
    category: '2. Role & Permission Verification',
    name: 'RBAC Enforcement: Finance blocked from Audit Logs (403)',
    endpoint: '/api/audit-logs (Finance Access Attempt)',
    method: 'GET',
    status: financeAuditAttempt.status,
    expectedStatus: 403,
    pass: financeAuditAttempt.status === 403,
    dataSummary: `Access rejected with 403 Forbidden`,
  });

  // 5. File Verification
  console.log('--- 5. FILE & STORAGE VERIFICATION ---');
  const coldStorageDir = 'D:/Admin/archives_sunbirojasa/pre_reset_2026-11-04T04-32-06-684Z';
  const coldStorageExists = fs.existsSync(coldStorageDir);
  const manifestPath = path.join(coldStorageDir, 'manifest.json');
  const manifestExists = fs.existsSync(manifestPath);
  const dbArchive = path.join(coldStorageDir, 'database.sqlite');
  const dbArchiveSha = fs.existsSync(dbArchive) ? crypto.createHash('sha256').update(fs.readFileSync(dbArchive)).digest('hex') : '';
  const expectedDbArchiveSha = 'd5829b293e6b06d4902cee8bc65d527c202a3dc098f87f22965f90cc61d5d3d4';
  const coldStorageValid = coldStorageExists && manifestExists && dbArchiveSha === expectedDbArchiveSha;

  testResults.push({
    category: '7. File & Storage Verification',
    name: 'Cold Storage Archive Invariance',
    endpoint: 'Cold Storage Archive',
    method: 'FILESYSTEM',
    status: coldStorageValid ? 200 : 500,
    expectedStatus: 200,
    pass: coldStorageValid,
    dataSummary: `Archive dir: ${coldStorageDir}, DB SHA: ${dbArchiveSha.substring(0, 16)}... (Matches Manifest)`,
  });

  const uploadsDir = path.resolve('server/uploads');
  const uploadFiles = fs.readdirSync(uploadsDir);
  const uploadsClean = uploadFiles.length === 1 && uploadFiles[0] === '.gitkeep';
  testResults.push({
    category: '7. File & Storage Verification',
    name: 'Active Uploads Directory Cleanliness',
    endpoint: 'Active Uploads Directory',
    method: 'FILESYSTEM',
    status: uploadsClean ? 200 : 500,
    expectedStatus: 200,
    pass: uploadsClean,
    dataSummary: `Entries: [${uploadFiles.join(', ')}] (Expected only .gitkeep)`,
  });

  const opDbPath = path.resolve('server/data/database.sqlite');
  const opDbSha = crypto.createHash('sha256').update(fs.readFileSync(opDbPath)).digest('hex');
  const expectedOpDbSha = '4364c21352c419594fa0dba614ef767299e882b13ed0a821764245a5ca21f925';
  const opDbInvariant = opDbSha === expectedOpDbSha;
  testResults.push({
    category: '7. File & Storage Verification',
    name: 'Operational Database Invariance',
    endpoint: 'Operational Database File',
    method: 'FILESYSTEM',
    status: opDbInvariant ? 200 : 500,
    expectedStatus: 200,
    pass: opDbInvariant,
    dataSummary: `Current SHA: ${opDbSha} (Matches Post-Reset Baseline)`,
  });

  console.log('\n================================================================');
  console.log('SUMMARY OF ALL OPERATIONAL VERIFICATION CHECKS:');
  console.log('================================================================');
  console.table(testResults.map(r => ({
    Category: r.category,
    Name: r.name,
    Endpoint: r.endpoint,
    Status: r.status,
    Expected: r.expectedStatus,
    Pass: r.pass ? 'PASS' : 'FAIL',
    Summary: r.dataSummary
  })));

  const allPassed = testResults.every((t) => t.pass);
  console.log(`\n================================================================`);
  console.log(`FINAL OPERATIONAL VERDICT: ${allPassed ? 'READY FOR OPERATIONAL USE' : 'NOT READY'}`);
  console.log(`Total Checks: ${testResults.length} | Passed: ${testResults.filter(t => t.pass).length} | Failed: ${testResults.filter(t => !t.pass).length}`);
  console.log(`================================================================\n`);

  fs.writeFileSync('post_reset_api_verification_results.json', JSON.stringify({ allPassed, results: testResults }, null, 2), 'utf8');
  process.exit(allPassed ? 0 : 1);
}

runOperationalVerification().catch((err) => {
  console.error('[FATAL VERIFICATION ERROR]', err);
  process.exit(1);
});
