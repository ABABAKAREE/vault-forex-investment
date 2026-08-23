const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { monthlyRoiFromWeekly, monthlyProfit } = require('../services/vaultMath');

const router = express.Router();

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ ok: false, message: 'User profile not found.' });
      return;
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', authenticate, async (req, res, next) => {
  const fullName = String(req.body?.fullName || '').trim();
  const phone = String(req.body?.phone || '').trim() || null;
  const password = String(req.body?.password || '');
  if (fullName.length < 2 || (password && password.length < 8)) {
    res.status(400).json({ ok: false, message: 'Full name is required and password must contain at least 8 characters.' });
    return;
  }

  try {
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           phone = $2,
           password_hash = COALESCE($3, password_hash)
       WHERE id = $4
       RETURNING id, full_name, email, phone, role, created_at`,
      [fullName, phone, passwordHash, req.user.id]
    );
    if (result.rowCount !== 1) {
      res.status(404).json({ ok: false, message: 'User profile not found.' });
      return;
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

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
        roi: monthlyRoiFromWeekly(row.weekly_roi_percent),
        monthlyProfit: monthlyProfit(row.capital_usd, row.weekly_roi_percent),
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
