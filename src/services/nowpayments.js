const crypto = require('crypto');
const axios = require('axios');

const API_BASE = 'https://api.nowpayments.io/v1';

// TRC20 USDT is cheapest/fastest; BTC native for BTC
const CURRENCY_MAP = {
  usdt: 'usdttrc20',
  btc: 'btc',
};

/**
 * Create a crypto payment invoice and return the deposit address.
 * @param {{ currency: string, amountUsd: number, orderId: string }} params
 * @returns {{ paymentId, payAddress, payAmount, payCurrency, expiresAt }}
 */
const createPayment = async ({ currency, amountUsd, orderId }) => {
  const payCurrency = CURRENCY_MAP[String(currency).toLowerCase()];
  if (!payCurrency) throw new Error(`Unsupported crypto currency: ${currency}`);

  const { data } = await axios.post(
    `${API_BASE}/payment`,
    {
      price_amount: amountUsd,
      price_currency: 'usd',
      pay_currency: payCurrency,
      order_id: String(orderId),
      order_description: 'Vault Invest Deposit',
      ipn_callback_url: process.env.NOWPAYMENTS_IPN_URL || '',
    },
    {
      headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY },
      timeout: 15_000,
    }
  );

  return {
    paymentId: String(data.payment_id),
    payAddress: data.pay_address,
    payAmount: data.pay_amount,
    payCurrency: data.pay_currency,
    expiresAt: data.expiration_estimate_date || null,
  };
};

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
  }
  return value;
};

const verifyIpnSignature = (payload, signature) => {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || '';
  if (!secret || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(sortObject(payload)))
    .digest('hex');

  return String(signature).length === expected.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
};

module.exports = { createPayment, verifyIpnSignature };
