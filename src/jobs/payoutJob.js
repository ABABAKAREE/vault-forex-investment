const cron = require('node-cron');
const pool = require('../db/pool');
const { monthlyRoiFromWeekly } = require('../services/vaultMath');

const runPayoutCycle = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dueInvestments = await client.query(
      `SELECT vi.id, vi.user_id, vi.vault_id, vi.capital_usd, vi.weekly_roi_percent, vi.next_payout_at, vc.cycle_days
       FROM vault_investments vi
       JOIN vault_catalog vc ON vc.vault_id = vi.vault_id
       WHERE vi.status = 'active' AND vi.next_payout_at <= NOW()
       FOR UPDATE`
    );

    for (const inv of dueInvestments.rows) {
      const payoutAmount = Number(inv.capital_usd) * (monthlyRoiFromWeekly(inv.weekly_roi_percent) / 100);

      await client.query('UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2', [payoutAmount, inv.user_id]);

      await client.query(
        `INSERT INTO transactions (user_id, tx_type, amount_usd, status, metadata)
         VALUES ($1, 'payout', $2, 'completed', $3::jsonb)`,
        [
          inv.user_id,
          payoutAmount,
          JSON.stringify({ vaultId: inv.vault_id, investmentId: inv.id }),
        ]
      );

      await client.query(
        `UPDATE vault_investments
         SET next_payout_at = next_payout_at + ($1::text || ' days')::interval
         WHERE id = $2`,
        [30, inv.id]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const startPayoutJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runPayoutCycle();
    } catch (error) {
      console.error('Payout job failed:', error.message);
    }
  });
};

module.exports = {
  startPayoutJob,
  runPayoutCycle,
};
