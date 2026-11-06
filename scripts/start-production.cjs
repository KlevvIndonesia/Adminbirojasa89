#!/usr/bin/env node
/**
 * Production Server Startup Wrapper for SUNBiroJasa / Admin SUN89
 * Explicitly sets NODE_ENV=production and launches the backend server.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const serverEntry = path.resolve(projectRoot, 'server/src/server.ts');

console.log('================================================================');
console.log('  SUNBiroJasa — Production Server Launch');
console.log('  Target Entry : server/src/server.ts');
console.log('  Enforcing    : NODE_ENV=production');
console.log('================================================================');

const childEnv = {
  ...process.env,
  NODE_ENV: 'production',
};

// Spawn tsx with inherited stdio to preserve logs and colors
const child = spawn('npx', ['--prefer-offline', 'tsx', serverEntry], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error('[SUN89 Launcher] Fatal error launching server process:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[SUN89 Launcher] Server terminated with signal ${signal}`);
  }
  process.exit(code ?? 0);
});
