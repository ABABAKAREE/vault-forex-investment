const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const required = isProduction ? ['DATABASE_URL', 'JWT_SECRET'] : ['JWT_SECRET'];

const requireEnv = (key) => {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
};

required.forEach(requireEnv);

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const appOrigin = String(
  process.env.APP_ORIGIN
    || (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
    || process.env.RAILWAY_STATIC_URL
    || 'http://localhost:3000'
).trim().replace(/\/$/, '');

module.exports = {
  port,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  paymentWebhookSecret: String(process.env.PAYMENT_WEBHOOK_SECRET || '').trim(),
  appOrigin,
  manualAccountName: process.env.MANUAL_ACCOUNT_NAME || 'Vault Invest Ltd',
  adminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
};
