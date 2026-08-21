const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'];

const requireEnv = (key) => {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
};

required.forEach(requireEnv);

const paymentProviderMode = (process.env.PAYMENT_PROVIDER_MODE || 'mock').toLowerCase();
if (!['mock', 'live'].includes(paymentProviderMode)) {
  throw new Error('PAYMENT_PROVIDER_MODE must be either "mock" or "live"');
}

const providerConfig = {
  azampay: {
    baseUrl: process.env.AZAMPAY_BASE_URL || '',
    apiKey: process.env.AZAMPAY_API_KEY || '',
    depositPath: process.env.AZAMPAY_DEPOSIT_PATH || '',
    withdrawPath: process.env.AZAMPAY_WITHDRAW_PATH || '',
  },
  intasend: {
    baseUrl: process.env.INTASEND_BASE_URL || '',
    apiKey: process.env.INTASEND_API_KEY || '',
    depositPath: process.env.INTASEND_DEPOSIT_PATH || '',
    withdrawPath: process.env.INTASEND_WITHDRAW_PATH || '',
  },
  flutterwave: {
    baseUrl: process.env.FLUTTERWAVE_BASE_URL || '',
    apiKey: process.env.FLUTTERWAVE_API_KEY || '',
    depositPath: process.env.FLUTTERWAVE_DEPOSIT_PATH || '',
    withdrawPath: process.env.FLUTTERWAVE_WITHDRAW_PATH || '',
  },
};

const hasAzampayClientCredentials = [
  process.env.AZAMPAY_APP_NAME,
  process.env.AZAMPAY_CLIENT_ID,
  process.env.AZAMPAY_CLIENT_SECRET,
  process.env.AZAMPAY_ACCOUNT_NUMBER,
].every((value) => Boolean(String(value).trim()));

if (paymentProviderMode === 'live') {
  requireEnv('PAYMENT_WEBHOOK_SECRET');

  const hasCompleteLiveProvider = Object.values(providerConfig).some((provider) => (
    provider.baseUrl && provider.apiKey && provider.depositPath && provider.withdrawPath
  ));

  if (!hasCompleteLiveProvider && !hasAzampayClientCredentials) {
    throw new Error('PAYMENT_PROVIDER_MODE=live requires at least one complete provider configuration or AzamPay credentials (AZAMPAY_APP_NAME, AZAMPAY_CLIENT_ID, AZAMPAY_CLIENT_SECRET, AZAMPAY_ACCOUNT_NUMBER)');
  }
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
  paymentProviderMode,
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  nowpaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
  providerConfig,
};
