const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { initiateDeposit, initiateWithdrawal } = require('../services/paymentProvider');
const nowpayments = require('../services/nowpayments');
const { paymentProviderMode } = require('../config/env');

const router = express.Router();

/** Return company bank account details + a unique reference for manual transfer */
router.get('/bank-details', authenticate, (_req, res) => {
  res.json({
    ok: true,
    bank: process.env.BANK_NAME || 'CRDB Bank Tanzania',
    accountName: process.env.BANK_ACCOUNT_NAME || 'Vault Invest Ltd',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
    branch: process.env.BANK_BRANCH || '',
    swiftCode: process.env.BANK_SWIFT || '',
    currency: 'TZS / USD',
    reference: `VI-${Date.now()}`,
    note: 'Include your reference number in the bank transfer description so your deposit is credited quickly.',
  });
});

router.post('/bank-deposit', authenticate, async (req, res, next) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, message: 'A positive deposit amount is required.' });
    return;
  }

  try {
    const reference = `VI-BANK-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const result = await pool.query(
      `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
       VALUES ($1, 'deposit', 'bank', $2, 'pending', $3, $4)
       RETURNING id, external_reference`,
      [req.user.id, amount, reference, JSON.stringify({ account: 'manual-bank-transfer' })]
    );

    res.json({
      ok: true,
      transactionId: result.rows[0].id,
      reference: result.rows[0].external_reference,
      bank: process.env.BANK_NAME || 'CRDB Bank Tanzania',
      accountName: process.env.BANK_ACCOUNT_NAME || 'Vault Invest Ltd',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
      branch: process.env.BANK_BRANCH || '',
      swiftCode: process.env.BANK_SWIFT || '',
      currency: 'TZS / USD',
      note: 'Include your reference number in the bank transfer description so your deposit is credited quickly.',
    });
  } catch (error) {
    next(error);
  }
});

/** Generate a crypto deposit address via NOWPayments */
router.post('/crypto-deposit', authenticate, async (req, res, next) => {
  const { currency, amount } = req.body || {};
  const parsedAmount = Number(amount);

  if (!currency || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'currency and a positive amount are required' });
    return;
  }

  if (paymentProviderMode !== 'live') {
    const mockAddresses = { usdt: 'TXmockUSDTaddress1234567890abcdef', btc: '1MockBTCaddressXYZ9876543210abcd' };
    res.json({
      ok: true,
      payAddress: mockAddresses[String(currency).toLowerCase()] || 'mock-address',
      payAmount: parsedAmount,
      payCurrency: currency,
      note: 'This is a mock address. Switch PAYMENT_PROVIDER_MODE to live for real addresses.',
    });
    return;
  }

  try {
    const client = await pool.connect();
    let txId;
    try {
      const tx = await client.query(
        `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status)
         VALUES ($1, 'deposit', $2, $3, 'pending') RETURNING id`,
        [req.user.id, currency, parsedAmount]
      );
      txId = tx.rows[0].id;
    } finally {
      client.release();
    }

    const result = await nowpayments.createPayment({
      currency,
      amountUsd: parsedAmount,
      orderId: String(txId),
    });

    await pool.query(
      `UPDATE transactions SET external_reference = $1, metadata = $2::jsonb WHERE id = $3`,
      [result.paymentId, JSON.stringify({ payAddress: result.payAddress, payCurrency: result.payCurrency }), txId]
    );

    res.json({
      ok: true,
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
      expiresAt: result.expiresAt,
      transactionId: txId,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/deposit', authenticate, async (req, res, next) => {
  const { method, account, amount, reference } = req.body || {};
  const parsedAmount = Number(amount);

  if (!method || !account || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'Invalid deposit payload' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = await client.query(
      `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
       VALUES ($1, 'deposit', $2, $3, 'pending', $4, $5)
       RETURNING id`,
      [req.user.id, method, parsedAmount, reference || null, JSON.stringify({ account })]
    );

    const providerResult = await initiateDeposit({
      channel: method,
      account,
      amount: parsedAmount,
      txId: tx.rows[0].id,
    });

    if (!providerResult.accepted) {
      await client.query(
        `UPDATE transactions SET status = 'failed', metadata = metadata || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ provider: providerResult.provider, providerResponse: providerResult.raw || null }), tx.rows[0].id]
      );
      await client.query('COMMIT');
      res.status(502).json({ ok: false, message: 'The payment provider rejected the deposit request.' });
      return;
    }

    await client.query(
      `UPDATE transactions
       SET external_reference = $1, metadata = metadata || $2::jsonb
       WHERE id = $3`,
      [providerResult.externalReference, JSON.stringify({ provider: providerResult.provider }), tx.rows[0].id]
    );

    if (providerResult.provider === 'mock') {
      await client.query('UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2', [parsedAmount, req.user.id]);
      await client.query("UPDATE transactions SET status = 'completed' WHERE id = $1", [tx.rows[0].id]);
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      transactionId: tx.rows[0].id,
      status: providerResult.provider === 'mock' ? 'completed' : 'pending',
      provider: providerResult.provider,
      externalReference: providerResult.externalReference,
      message: providerResult.provider === 'mock' ? 'Deposit completed in mock mode' : 'Deposit initiated. Await webhook confirmation.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/withdraw', authenticate, async (req, res, next) => {
  const { method, account, amount, reference } = req.body || {};
  const parsedAmount = Number(amount);

  if (!method || !account || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'Invalid withdrawal payload' });
    return;
  }

  if (parsedAmount < 5) {
    res.status(400).json({ ok: false, message: 'Minimum withdrawal is $5.00.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const accountRow = await client.query('SELECT balance_usd FROM accounts WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const balance = Number(accountRow.rows[0]?.balance_usd || 0);
    if (parsedAmount > balance) {
      await client.query('ROLLBACK');
      res.status(400).json({ ok: false, message: 'Insufficient balance.' });
      return;
    }

    await client.query('UPDATE accounts SET balance_usd = balance_usd - $1 WHERE user_id = $2', [parsedAmount, req.user.id]);

    const tx = await client.query(
      `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
       VALUES ($1, 'withdrawal', $2, $3, 'sent', $4, $5)
       RETURNING id`,
      [req.user.id, method, parsedAmount, reference || null, JSON.stringify({ account })]
    );

    const providerResult = await initiateWithdrawal({
      channel: method,
      account,
      amount: parsedAmount,
      txId: tx.rows[0].id,
    });

    if (!providerResult.accepted) {
      await client.query('UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2', [parsedAmount, req.user.id]);
      await client.query(
        `UPDATE transactions
         SET external_reference = $1, metadata = metadata || $2::jsonb, status = 'failed'
         WHERE id = $3`,
        [providerResult.externalReference, JSON.stringify({ provider: providerResult.provider, providerResponse: providerResult.raw || null }), tx.rows[0].id]
      );
      await client.query('COMMIT');
      res.status(502).json({ ok: false, message: 'The payment provider rejected the withdrawal request.' });
      return;
    }

    await client.query(
      `UPDATE transactions
       SET external_reference = $1, metadata = metadata || $2::jsonb, status = $3
       WHERE id = $4`,
      [providerResult.externalReference, JSON.stringify({ provider: providerResult.provider }), providerResult.status, tx.rows[0].id]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      transactionId: tx.rows[0].id,
      status: providerResult.status,
      provider: providerResult.provider,
      externalReference: providerResult.externalReference,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
