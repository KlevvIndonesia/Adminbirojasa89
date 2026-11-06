const path = require('path');
const { spawn } = require('child_process');

const testDbPath = path.resolve(__dirname, '../server/data/database-functional-test.sqlite');
console.log('[START TEST BACKEND] Setting DB_PATH =', testDbPath);

const env = {
  ...process.env,
  DB_PATH: testDbPath,
};

const child = spawn('npx', ['--prefer-offline', 'tsx', 'server/src/server.ts'], {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('exit', (code) => {
  console.log('[START TEST BACKEND] Exited with code:', code);
  process.exit(code || 0);
});
