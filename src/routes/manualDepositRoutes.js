const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const paymentNetworks = {
  mpesa: { name: 'M-Pesa', phone: process.env.MANUAL_MPESA_PHONE || '' },
  tigo: { name: 'Tigo Pesa', phone: process.env.MANUAL_TIGO_PHONE || '' },
  airtel: { name: 'Airtel Money', phone: process.env.MANUAL_AIRTEL_PHONE || '' },
  halopesa: { name: 'HaloPesa', phone: process.env.MANUAL_HALOPESA_PHONE || '' },
};

router.get('/networks', authenticate, (_req, res) => {
  res.json({
    ok: true,
    accountName: process.env.MANUAL_ACCOUNT_NAME || 'Vault Invest Ltd',
    networks: paymentNetworks,
  });
});

router.post('/', authenticate, upload.single('receipt'), async (req, res, next) => {
  const network = String(req.body?.networkSelected || '').toLowerCase();
  const amount = Number(req.body?.amount);
  const transactionId = String(req.body?.transactionId || `PENDING-${Date.now()}`).trim();

  if (!paymentNetworks[network] || !Number.isFinite(amount) || amount <= 0 || !transactionId || !req.file) {
    res.status(400).json({ ok: false, message: 'Network, amount, transaction ID, and receipt image are required.' });
    return;
  }

  try {
    const receiptImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
      `INSERT INTO manual_deposits (user_id, network_selected, amount_usd, transaction_id, receipt_image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [req.user.id, network, amount, transactionId, receiptImageUrl]
      );
      const deposit = result.rows[0];
      await client.query(
        `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
         VALUES ($1, 'deposit', 'manual', $2, 'pending', $3, $4)`,
        [req.user.id, amount, String(deposit.id), JSON.stringify({ manualDepositId: deposit.id, transactionId })]
      );
      await client.query('COMMIT');
      res.status(201).json({ ok: true, deposit, message: 'Deposit submitted for admin verification.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (String(error?.message || '').includes('manual_deposits_network_transaction_idx')) {
      res.status(409).json({ ok: false, message: 'This transaction ID has already been submitted.' });
      return;
    }
    next(error);
  }
});

router.get('/pending', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT md.id, md.network_selected, md.amount_usd, md.transaction_id, md.receipt_image_url,
              md.status, md.created_at, u.email, u.full_name
       FROM manual_deposits md JOIN users u ON u.id = md.user_id
       WHERE md.status = 'pending' ORDER BY md.created_at ASC`
    );
    res.json({ ok: true, deposits: result.rows });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/review', authenticate, requireAdmin, async (req, res, next) => {
  const decision = String(req.body?.decision || '').toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ ok: false, message: 'Decision must be approved or rejected.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const depositResult = await client.query(
      `SELECT id, user_id, amount_usd, status FROM manual_deposits WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const deposit = depositResult.rows[0];
    if (!deposit || deposit.status !== 'pending') {
      await client.query('ROLLBACK');
      res.status(404).json({ ok: false, message: 'Pending deposit not found.' });
      return;
    }

    await client.query(
      `UPDATE manual_deposits SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [decision, req.user.id, deposit.id]
    );
    if (decision === 'approved') {
      const transactionResult = await client.query(
        `SELECT id, status FROM transactions
         WHERE external_reference = $1 AND user_id = $2 AND tx_type = 'deposit'
         FOR UPDATE`,
        [String(deposit.id), deposit.user_id]
      );
      const transaction = transactionResult.rows[0];
      if (transaction?.status === 'pending') {
        const balanceResult = await client.query(
          'UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2',
          [deposit.amount_usd, deposit.user_id]
        );
        if (balanceResult.rowCount !== 1) {
          throw new Error('Account not found for manual deposit approval');
        }
        await client.query(
          `UPDATE transactions
           SET status = 'completed', updated_at = NOW(), metadata = metadata || $1::jsonb
           WHERE id = $2`,
          [JSON.stringify({ manualDepositId: deposit.id, approved: true }), transaction.id]
        );
      } else if (!transaction) {
        const balanceResult = await client.query(
          'UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2',
          [deposit.amount_usd, deposit.user_id]
        );
        if (balanceResult.rowCount !== 1) {
          throw new Error('Account not found for manual deposit approval');
        }
        await client.query(
          `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
           VALUES ($1, 'deposit', 'manual', $2, 'completed', $3, $4)`,
          [deposit.user_id, deposit.amount_usd, String(deposit.id), JSON.stringify({ manualDepositId: deposit.id, approved: true })]
        );
      }
    } else {
      await client.query(
        `UPDATE transactions
         SET status = 'failed', updated_at = NOW(), metadata = metadata || $1::jsonb
         WHERE external_reference = $2 AND user_id = $3 AND tx_type = 'deposit'`,
        [JSON.stringify({ manualDepositId: deposit.id, rejected: true }), String(deposit.id), deposit.user_id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, status: decision });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
