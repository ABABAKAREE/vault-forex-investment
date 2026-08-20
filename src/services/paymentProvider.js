const crypto = require('crypto');
const { paymentProviderMode, paymentWebhookSecret } = require('../config/env');
const azampay = require('./azampay');
const nowpayments = require('./nowpayments');

const buildReference = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const MOBILE_CHANNELS = new Set(['mpesa', 'tigo', 'airtel', 'halopesa']);
const CRYPTO_CHANNELS = new Set(['usdt', 'btc']);

const initiateDeposit = async ({ channel, account, amount, txId }) => {
  if (paymentProviderMode !== 'live') {
    return {
      accepted: true,
      provider: 'mock',
      externalReference: buildReference('MOCK-DEP'),
      status: 'pending',
      raw: { txId, channel, account, amount },
    };
  }

  const normalized = String(channel || '').toLowerCase();

  if (MOBILE_CHANNELS.has(normalized)) {
    const result = await azampay.checkout({
      phone: account,
      amountUsd: amount,
      channel: normalized,
      externalId: String(txId),
    });
    return {
      accepted: result.success,
      provider: 'azampay',
      externalReference: result.transactionId || buildReference('AZM-DEP'),
      status: 'pending',
      raw: result.raw,
    };
  }

  if (CRYPTO_CHANNELS.has(normalized)) {
    const result = await nowpayments.createPayment({
      currency: normalized,
      amountUsd: amount,
      orderId: String(txId),
    });
    return {
      accepted: true,
      provider: 'nowpayments',
      externalReference: result.paymentId,
      status: 'pending',
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
      raw: result,
    };
  }

  // Bank transfer — no API call; manual reconciliation via reference
  return {
    accepted: true,
    provider: 'bank',
    externalReference: buildReference('BANK-DEP'),
    status: 'pending',
    raw: { txId, channel, account, amount },
  };
};

const initiateWithdrawal = async ({ channel, account, amount, txId }) => {
  if (paymentProviderMode !== 'live') {
    return {
      accepted: true,
      provider: 'mock',
      externalReference: buildReference('MOCK-WDR'),
      status: 'sent',
      raw: { txId, channel, account, amount },
    };
  }

  const normalized = String(channel || '').toLowerCase();

  if (MOBILE_CHANNELS.has(normalized)) {
    const result = await azampay.disburse({
      phone: account,
      amountUsd: amount,
      channel: normalized,
      externalId: String(txId),
    });
    return {
      accepted: result.success,
      provider: 'azampay',
      externalReference: result.transactionId || buildReference('AZM-WDR'),
      status: result.success ? 'sent' : 'failed',
      raw: result.raw,
    };
  }

  // Crypto and bank withdrawals are queued for manual/admin processing
  return {
    accepted: true,
    provider: CRYPTO_CHANNELS.has(normalized) ? 'crypto-manual' : 'bank-manual',
    externalReference: buildReference('MANUAL-WDR'),
    status: 'pending',
    raw: { txId, channel, account, amount },
  };
};

const verifyWebhookSignature = (rawBodyBuffer, headerSignature) => {
  if (!paymentWebhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', paymentWebhookSecret)
    .update(rawBodyBuffer)
    .digest('hex');

  if (!headerSignature || String(headerSignature).length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerSignature || ''));
};

module.exports = {
  initiateDeposit,
  initiateWithdrawal,
  verifyWebhookSignature,
};
