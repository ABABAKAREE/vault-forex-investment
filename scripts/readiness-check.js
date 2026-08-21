const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const envPath = path.join(root, '.env');

const print = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => process.stderr.write(`FAIL: ${msg}\n`);

const parseEnv = (content) => {
  const map = new Map();
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const idx = trimmed.indexOf('=');
    if (idx <= 0) {
      return;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    map.set(key, value);
  });
  return map;
};

let hasFailure = false;

print('Readiness check started...');

if (!fs.existsSync(envPath)) {
  fail('.env file is missing. Copy .env.example to .env and set values.');
  process.exit(1);
}

const envMap = parseEnv(fs.readFileSync(envPath, 'utf8'));
Object.entries(process.env).forEach(([key, value]) => {
  if (value) envMap.set(key, value);
});
const required = ['DATABASE_URL', 'JWT_SECRET', 'APP_ORIGIN'];
required.forEach((key) => {
  const val = envMap.get(key);
  if (!val) {
    hasFailure = true;
    fail(`Missing ${key} in .env`);
  }
});

const jwtSecret = envMap.get('JWT_SECRET') || '';
if (jwtSecret.includes('change-this') || jwtSecret.length < 16) {
  hasFailure = true;
  fail('JWT_SECRET looks weak/default. Use a long random secret (16+ chars).');
}

const networks = ['MANUAL_MPESA_PHONE', 'MANUAL_TIGO_PHONE', 'MANUAL_AIRTEL_PHONE', 'MANUAL_HALOPESA_PHONE'];
if (!networks.some((key) => envMap.get(key))) {
  hasFailure = true;
  fail('At least one manual mobile-money destination number is required.');
}

print('Running auth regression tests...');
const tests = spawnSync('node', ['--test', 'tests/auth-helpers.test.js'], { stdio: 'inherit' });
if (tests.status !== 0) {
  hasFailure = true;
  fail('Auth tests failed.');
}

if (hasFailure) {
  process.exit(1);
}

print('Readiness check passed.');
