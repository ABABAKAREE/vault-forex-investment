const axios = require('axios');

const BASE_URLS = {
  live: 'https://checkout.azampay.co.tz',
  sandbox: 'https://sandbox.azampay.co.tz',
};

let tokenCache = { token: null, expiresAt: 0 };

const getBaseUrl = () =>
  process.env.AZAMPAY_ENV === 'sandbox' ? BASE_URLS.sandbox : BASE_URLS.live;

const getToken = async () => {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const { data } = await axios.post(
    `${getBaseUrl()}/authenticator/api/Account/GenerateToken`,
    {
      appName: process.env.AZAMPAY_APP_NAME,
      clientId: process.env.AZAMPAY_CLIENT_ID,
      clientSecret: process.env.AZAMPAY_CLIENT_SECRET,
    },
    { timeout: 10_000 }
  );

  if (!data?.success || !data?.data?.accessToken) {
    throw new Error(`AzamPay token error: ${data?.message || 'unknown'}`);
  }

  const expiresAt = new Date(data.data.expire).getTime();
  tokenCache = { token: data.data.accessToken, expiresAt };
  return tokenCache.token;
};

const PROVIDER_MAP = {
  mpesa: 'Mpesa',
  tigo: 'Tigo',
  airtel: 'Airtel',
  halopesa: 'Halopesa',
};

/** Convert USD to TZS using the configured rate */
const toTzs = (usd) => {
  const rate = Number(process.env.AZAMPAY_USD_TZS_RATE || 2600);
  return Math.round(usd * rate);
};

/**
 * Initiate mobile money STK push (deposit).
 * @param {{ phone: string, amountUsd: number, channel: string, externalId: string }} params
 */
const checkout = async ({ phone, amountUsd, channel, externalId }) => {
  const token = await getToken();
  const provider = PROVIDER_MAP[String(channel).toLowerCase()];
  if (!provider) throw new Error(`Unsupported AzamPay channel: ${channel}`);

  const amountTzs = String(toTzs(amountUsd));

  const { data } = await axios.post(
    `${getBaseUrl()}/azampay/mobile/checkout`,
    {
      accountNumber: phone,
      amount: amountTzs,
      additionalProperties: {},
      currency: 'TZS',
      externalId,
      provider,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    }
  );

  return {
    success: !!data?.success,
    transactionId: data?.transactionId || null,
    message: data?.message || 'STK push sent to phone',
    raw: data,
  };
};

/**
 * B2C disbursement — send money to a phone number (withdrawal).
 * @param {{ phone: string, amountUsd: number, channel: string, externalId: string }} params
 */
const disburse = async ({ phone, amountUsd, channel, externalId }) => {
  const token = await getToken();
  const provider = PROVIDER_MAP[String(channel).toLowerCase()];
  if (!provider) throw new Error(`Unsupported AzamPay channel: ${channel}`);

  const amountTzs = String(toTzs(amountUsd));

  const { data } = await axios.post(
    `${getBaseUrl()}/azampay/mobile/disburse`,
    {
      source: process.env.AZAMPAY_ACCOUNT_NUMBER,
      destination: phone,
      transferType: provider,
      countryCode: 'TZ',
      currency: 'TZS',
      amount: amountTzs,
      referenceId: externalId,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    }
  );

  return {
    success: !!data?.success,
    transactionId: data?.transactionId || null,
    message: data?.message || 'Disbursement initiated',
    raw: data,
  };
};

module.exports = { checkout, disburse };
