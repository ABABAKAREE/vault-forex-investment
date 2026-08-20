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

module.exports = { createPayment };
