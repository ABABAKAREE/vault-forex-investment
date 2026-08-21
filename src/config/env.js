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

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
  manualAccountName: process.env.MANUAL_ACCOUNT_NAME || 'Vault Invest Ltd',
  adminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
};
