const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { port, appOrigin } = require('./src/config/env');
const { migrate } = require('./src/db/migrate');
const { errorHandler } = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/authRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const vaultRoutes = require('./src/routes/vaultRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');
const { startPayoutJob } = require('./src/jobs/payoutJob');

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://s3.tradingview.com'],
        'connect-src': ["'self'", 'https://api.frankfurter.dev'],
      },
    },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === appOrigin || origin === 'null') {
        callback(null, true);
      } else {
        callback(new Error('CORS origin denied'));
      }
    },
    credentials: true,
  })
);
app.use('/api', apiLimiter);
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vault-api', now: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/vaults', vaultRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, message: 'API endpoint not found' });
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(errorHandler);

const bootstrap = async () => {
  try {
    await migrate();
  } catch (error) {
    console.warn('Database unavailable, continuing in fallback mode:', error.message);
  }

  startPayoutJob();

  app.listen(port, () => {
    console.log(`Vault API server running at http://localhost:${port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
