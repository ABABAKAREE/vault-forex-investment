const express = require('express');
const pool = require('../db/pool');
const { verifyWebhookSignature } = require('../services/paymentProvider');
const { verifyIpnSignature } = require('../services/nowpayments');

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

    const payload = JSON.parse(raw.toString('utf8'));
    const validSignature = provider.toLowerCase() === 'nowpayments'
      ? verifyIpnSignature(payload, req.headers['x-nowpayments-sig'])
      : verifyWebhookSignature(raw, signature);
    if (!validSignature) {
      res.status(401).json({ ok: false, message: 'Invalid webhook signature' });
      return;
    }

    const eventId = String(payload.eventId || payload.id || payload.payment_id || payload.order_id || '');

    if (eventId) {
      const duplicate = await pool.query(
        'SELECT id FROM payment_webhooks WHERE provider = $1 AND event_id = $2 LIMIT 1',
        [provider, eventId]
      );
      if (duplicate.rows.length) {
        res.json({ ok: true, duplicate: true });
        return;
      }
    }

    await pool.query(
      'INSERT INTO payment_webhooks (provider, event_id, payload) VALUES ($1, $2, $3)',
      [provider, eventId, payload]
    );

    const externalReference = payload.externalReference || payload.reference || payload.payment_id || null;
    const orderId = payload.order_id || null;
    const status = String(payload.status || payload.payment_status || '').toLowerCase();

    if ((externalReference || orderId) && ['successful', 'success', 'completed', 'finished', 'confirmed'].includes(status)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const txRes = await client.query(
          `SELECT id, user_id, tx_type, amount_usd, status
           FROM transactions
           WHERE external_reference = $1 OR id::text = $2
           FOR UPDATE`,
          [externalReference, String(orderId || '')]
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
