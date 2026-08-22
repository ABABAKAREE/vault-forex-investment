const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const [account, activities, vaults] = await Promise.all([
      pool.query('SELECT balance_usd FROM accounts WHERE user_id = $1', [req.user.id]),
      pool.query(
        `SELECT tx_type, amount_usd, status, created_at FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 12`,
        [req.user.id]
      ),
      pool.query(
        `SELECT vi.vault_id, vi.capital_usd, vi.weekly_roi_percent, vi.status, vi.activated_at, vi.next_payout_at, vc.title
         FROM vault_investments vi
         JOIN vault_catalog vc ON vc.vault_id = vi.vault_id
         WHERE vi.user_id = $1 AND vi.status = 'active'`,
        [req.user.id]
      ),
    ]);

    const deposits = await pool.query(
      `SELECT id, network_selected, amount_usd, transaction_id, status, created_at, reviewed_at
       FROM manual_deposits
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    const balance = Number(account.rows[0]?.balance_usd || 0);
    const recentActivities = activities.rows.map((row) => ({
      title: `${row.tx_type.toUpperCase()} $${Number(row.amount_usd).toFixed(2)}`,
      amount: Number(row.amount_usd),
      status: row.status,
      createdAt: row.created_at,
    }));

    const activeVaults = {};
    vaults.rows.forEach((row) => {
      activeVaults[row.vault_id] = {
        name: row.title,
        capital: Number(row.capital_usd),
        roi: Number(row.weekly_roi_percent),
        status: row.status,
        activatedAt: row.activated_at,
        payoutStart: row.next_payout_at,
      };
    });

    res.json({
      ok: true,
      balance,
      recentActivities,
      manualDeposits: deposits.rows,
      vaults: activeVaults,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
