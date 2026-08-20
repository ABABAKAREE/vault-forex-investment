const express = require('express');
const pool = require('../db/pool');
const { verifyWebhookSignature } = require('../services/paymentProvider');

const router = express.Router();

router.post('/payments/:provider', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const signature = req.headers['x-webhook-signature'];
    const raw = req.body;

    if (!Buffer.isBuffer(raw)) {
      res.status(400).json({ ok: false, message: 'Invalid webhook payload format' });
      return;
    }

    if (!verifyWebhookSignature(raw, signature)) {
      res.status(401).json({ ok: false, message: 'Invalid webhook signature' });
      return;
    }

    const payload = JSON.parse(raw.toString('utf8'));
    const eventId = payload.eventId || payload.id || null;

    await pool.query(
      'INSERT INTO payment_webhooks (provider, event_id, payload) VALUES ($1, $2, $3)',
      [provider, eventId, payload]
    );

    const externalReference = payload.externalReference || payload.reference;
    const status = String(payload.status || '').toLowerCase();

    if (externalReference && (status === 'successful' || status === 'success' || status === 'completed')) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const txRes = await client.query(
          `SELECT id, user_id, tx_type, amount_usd, status
           FROM transactions
           WHERE external_reference = $1
           FOR UPDATE`,
          [externalReference]
        );

        const tx = txRes.rows[0];
        if (tx && tx.tx_type === 'deposit' && tx.status !== 'completed') {
          await client.query('UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2', [Number(tx.amount_usd), tx.user_id]);
          await client.query("UPDATE transactions SET status = 'completed' WHERE id = $1", [tx.id]);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
