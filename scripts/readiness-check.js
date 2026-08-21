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

const webhook = envMap.get('PAYMENT_WEBHOOK_SECRET') || '';
if (!webhook || webhook.includes('change-this')) {
  hasFailure = true;
  fail('PAYMENT_WEBHOOK_SECRET is missing or default-like.');
}

const providerMode = (envMap.get('PAYMENT_PROVIDER_MODE') || 'mock').toLowerCase();
if (!['mock', 'live'].includes(providerMode)) {
  hasFailure = true;
  fail('PAYMENT_PROVIDER_MODE must be mock or live.');
}

if (providerMode === 'live') {
  const providers = [
    {
      name: 'AZAMPAY',
      base: envMap.get('AZAMPAY_BASE_URL'),
      key: envMap.get('AZAMPAY_API_KEY'),
      deposit: envMap.get('AZAMPAY_DEPOSIT_PATH'),
      withdraw: envMap.get('AZAMPAY_WITHDRAW_PATH'),
    },
    {
      name: 'INTASEND',
      base: envMap.get('INTASEND_BASE_URL'),
      key: envMap.get('INTASEND_API_KEY'),
      deposit: envMap.get('INTASEND_DEPOSIT_PATH'),
      withdraw: envMap.get('INTASEND_WITHDRAW_PATH'),
    },
    {
      name: 'FLUTTERWAVE',
      base: envMap.get('FLUTTERWAVE_BASE_URL'),
      key: envMap.get('FLUTTERWAVE_API_KEY'),
      deposit: envMap.get('FLUTTERWAVE_DEPOSIT_PATH'),
      withdraw: envMap.get('FLUTTERWAVE_WITHDRAW_PATH'),
    },
  ];

  const hasProvider = providers.some((p) => p.base && p.key && p.deposit && p.withdraw);
  const hasAzampayClientCredentials = [
    envMap.get('AZAMPAY_APP_NAME'),
    envMap.get('AZAMPAY_CLIENT_ID'),
    envMap.get('AZAMPAY_CLIENT_SECRET'),
    envMap.get('AZAMPAY_ACCOUNT_NUMBER'),
  ].every(Boolean);

  if (!hasProvider && !hasAzampayClientCredentials) {
    hasFailure = true;
    fail('PAYMENT_PROVIDER_MODE=live but no provider or complete AzamPay client credentials are configured.');
  }

  if (envMap.get('NOWPAYMENTS_API_KEY') && !envMap.get('NOWPAYMENTS_IPN_SECRET')) {
    hasFailure = true;
    fail('NOWPAYMENTS_API_KEY is configured but NOWPAYMENTS_IPN_SECRET is missing.');
  }
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
