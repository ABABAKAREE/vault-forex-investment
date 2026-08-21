const axios = require('axios');

const BASE_URLS = {
  live: 'https://checkout.azampay.co.tz',
  sandbox: 'https://sandbox.azampay.co.tz',
};

let tokenCache = { token: null, expiresAt: 0 };

const providerError = (message) => {
  const error = new Error(message);
  error.status = 502;
  error.code = 'PAYMENT_PROVIDER_ERROR';
  return error;
};

const logAzamPayError = (operation, error) => {
  const details = {
    operation,
    message: error?.message || 'Unknown Axios error',
    code: error?.code || null,
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    responseData: error?.response?.data || null,
  };

  console.error('[AzamPay] API request failed:', details);
};

const getBaseUrl = () =>
  process.env.AZAMPAY_ENV === 'sandbox' ? BASE_URLS.sandbox : BASE_URLS.live;

const getToken = async () => {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  let data;
  try {
    ({ data } = await axios.post(
      `${getBaseUrl()}/authenticator/api/Account/GenerateToken`,
      {
        appName: process.env.AZAMPAY_APP_NAME,
        clientId: process.env.AZAMPAY_CLIENT_ID,
        clientSecret: process.env.AZAMPAY_CLIENT_SECRET,
      },
      { timeout: 10_000 }
    ));
  } catch (error) {
    logAzamPayError('GenerateToken', error);
    throw providerError('Mobile money provider authentication failed. Check AzamPay credentials and environment.');
  }

  if (!data?.success || !data?.data?.accessToken) {
    throw providerError(`Mobile money provider rejected authentication: ${data?.message || 'unknown'}`);
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

  let data;
  try {
    ({ data } = await axios.post(
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
    ));
  } catch (error) {
    logAzamPayError('MobileCheckout', error);
    throw providerError('Mobile money deposit could not reach AzamPay. Verify the phone number, credentials, and provider environment.');
  }

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

  let data;
  try {
    ({ data } = await axios.post(
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
    ));
  } catch (error) {
    logAzamPayError('MobileDisburse', error);
    throw providerError('Mobile money withdrawal could not reach AzamPay. Verify the phone number, credentials, and provider environment.');
  }

  return {
    success: !!data?.success,
    transactionId: data?.transactionId || null,
    message: data?.message || 'Disbursement initiated',
    raw: data,
  };
};

module.exports = { checkout, disburse };
