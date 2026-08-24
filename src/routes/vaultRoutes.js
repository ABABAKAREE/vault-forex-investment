const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { nextPayoutByCycle, monthlyRoiFromWeekly, monthlyProfit, payoutInstallment } = require('../services/vaultMath');

const router = express.Router();

router.get('/catalog', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT vault_id, title, tier, capital_usd, weekly_roi_percent, cycle_days, payout_installments FROM vault_catalog ORDER BY capital_usd ASC');
    res.json({ ok: true, vaults: result.rows.map((vault) => ({
      vaultId: vault.vault_id,
      title: vault.title,
      tier: vault.tier,
      capitalUsd: Number(vault.capital_usd),
      monthlyRoiPercent: monthlyRoiFromWeekly(vault.weekly_roi_percent),
      monthlyProfitUsd: monthlyProfit(vault.capital_usd, vault.weekly_roi_percent),
      payoutAmountUsd: payoutInstallment(vault.capital_usd, vault.weekly_roi_percent, vault.payout_installments),
      payoutFrequency: vault.cycle_days === 14 ? 'bi-weekly' : 'monthly',
      cycleDays: Number(vault.cycle_days),
      payoutInstallments: Number(vault.payout_installments),
    })) });
  } catch (error) {
    next(error);
  }
});

router.post('/invest', authenticate, async (req, res, next) => {
  const { vaultId } = req.body || {};
  if (!vaultId) {
    res.status(400).json({ ok: false, message: 'vaultId is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vaultResult = await client.query(
      'SELECT vault_id, title, capital_usd, weekly_roi_percent, cycle_days, payout_installments FROM vault_catalog WHERE vault_id = $1',
      [vaultId]
    );
    const vault = vaultResult.rows[0];
    if (!vault) {
      await client.query('ROLLBACK');
      res.status(404).json({ ok: false, message: 'Vault tier not found' });
      return;
    }

    const activeResult = await client.query(
      `SELECT id FROM vault_investments
       WHERE user_id = $1 AND vault_id = $2 AND status = 'active'`,
      [req.user.id, vaultId]
    );
    if (activeResult.rowCount > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ ok: false, message: 'Vault tier is already active.' });
      return;
    }

    const accountRow = await client.query('SELECT balance_usd FROM accounts WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const balance = Number(accountRow.rows[0]?.balance_usd || 0);
    const capital = Number(vault.capital_usd);
    if (balance < capital) {
      await client.query('ROLLBACK');
      res.status(400).json({ ok: false, message: 'Insufficient balance. Please deposit funds first.' });
      return;
    }

    await client.query('UPDATE accounts SET balance_usd = balance_usd - $1 WHERE user_id = $2', [capital, req.user.id]);

    const activatedAt = new Date();
    const nextPayout = nextPayoutByCycle(activatedAt, Number(vault.cycle_days));

    const investment = await client.query(
      `INSERT INTO vault_investments
       (user_id, vault_id, status, capital_usd, weekly_roi_percent, activated_at, next_payout_at)
       VALUES ($1, $2, 'active', $3, $4, $5, $6)
       RETURNING id, activated_at, next_payout_at`,
      [req.user.id, vaultId, capital, Number(vault.weekly_roi_percent), activatedAt.toISOString(), nextPayout.toISOString()]
    );

    await client.query(
      `INSERT INTO transactions (user_id, tx_type, amount_usd, status, metadata)
       VALUES ($1, 'investment', $2, 'completed', $3)`,
      [req.user.id, capital, JSON.stringify({ vaultId, vaultTitle: vault.title, weeklyRoi: Number(vault.weekly_roi_percent) })]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      vault: {
        id: vault.vault_id,
        name: vault.title,
        capital,
        roi: Number(vault.weekly_roi_percent),
        monthlyRoi: monthlyRoiFromWeekly(vault.weekly_roi_percent),
        monthlyProfit: monthlyProfit(vault.capital_usd, vault.weekly_roi_percent),
        payoutAmount: payoutInstallment(vault.capital_usd, vault.weekly_roi_percent, vault.payout_installments),
        payoutFrequency: vault.cycle_days === 14 ? 'bi-weekly' : 'monthly',
        payoutInstallments: Number(vault.payout_installments),
        activatedAt: investment.rows[0].activated_at,
        payoutStart: investment.rows[0].next_payout_at,
        status: 'active',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
