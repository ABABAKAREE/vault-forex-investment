const crypto = require('crypto');
const paymentWebhookSecret = '';

const buildReference = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const initiateDeposit = async ({ channel, account, amount, txId }) => {
  return {
    accepted: true,
    provider: 'manual',
    externalReference: buildReference('MANUAL-DEP'),
    status: 'pending',
    raw: { txId, channel, account, amount },
  };
};

const initiateWithdrawal = async ({ channel, account, amount, txId }) => {
  return {
    accepted: true,
    provider: 'manual',
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
