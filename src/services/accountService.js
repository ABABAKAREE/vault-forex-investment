const pool = require('../db/pool');
const { nextSundayFromNowUtc } = require('./vaultMath');

const MIN_WITHDRAWAL = 5;

const mapActivity = (tx) => ({
  title:
    tx.tx_type === 'deposit'
      ? `Deposit $${Number(tx.amount_usd).toFixed(2)}`
      : tx.tx_type === 'withdrawal'
      ? `Withdrawal $${Number(tx.amount_usd).toFixed(2)}`
      : tx.tx_type === 'investment'
      ? `Invested in ${tx.metadata?.vaultTitle || 'Vault'}`
      : `Payout $${Number(tx.amount_usd).toFixed(2)}`,
  status: tx.status,
});

const getSummary = async (userId) => {
  const [accountResult, txResult, vaultResult] = await Promise.all([
    pool.query('SELECT balance_usd FROM accounts WHERE user_id = $1', [userId]),
    pool.query('SELECT tx_type, amount_usd, status, metadata FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]),
    pool.query('SELECT vault_id, status, capital_usd, weekly_roi_percent, activated_at, next_payout_at FROM vault_investments WHERE user_id = $1 AND status = $2', [userId, 'active']),
  ]);

  const balance = Number(accountResult.rows[0]?.balance_usd || 0);
  const recentActivities = txResult.rows.map(mapActivity);

  const vaults = {};
  vaultResult.rows.forEach((row) => {
    vaults[row.vault_id] = {
      status: row.status,
      capital: Number(row.capital_usd),
      roi: Number(row.weekly_roi_percent),
      activatedAt: row.activated_at,
      payoutStart: row.next_payout_at,
    };
  });

  return { balance, recentActivities, vaults };
};

const createDepositRequest = async ({ userId, channel, account, amount, externalReference, metadata }) => {
  const tx = await pool.query(
    `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
     VALUES ($1, 'deposit', $2, $3, 'pending', $4, $5)
     RETURNING id, amount_usd, status`,
    [userId, channel, amount, externalReference || null, metadata || {}]
  );

  return tx.rows[0];
};

const markDepositCompleted = async ({ txId, externalReference }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txResult = await client.query(
      `SELECT id, user_id, amount_usd, status FROM transactions WHERE id = $1 FOR UPDATE`,
      [txId]
    );
    const tx = txResult.rows[0];

    if (!tx) {
      throw new Error('Transaction not found');
    }
    if (tx.status === 'completed') {
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `UPDATE transactions
       SET status = 'completed', external_reference = COALESCE($2, external_reference), metadata = jsonb_set(metadata, '{confirmedAt}', to_jsonb(NOW()::text), true)
       WHERE id = $1`,
      [txId, externalReference || null]
    );

    await client.query('UPDATE accounts SET balance_usd = balance_usd + $1 WHERE user_id = $2', [tx.amount_usd, tx.user_id]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const withdraw = async ({ userId, channel, account, amount, externalReference, metadata }) => {
  if (Number(amount) < MIN_WITHDRAWAL) {
    return { ok: false, code: 400, message: 'Minimum withdrawal is $5.00.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const accountResult = await client.query('SELECT balance_usd FROM accounts WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(accountResult.rows[0]?.balance_usd || 0);

    if (Number(amount) > balance) {
      await client.query('ROLLBACK');
      return { ok: false, code: 400, message: 'Insufficient balance.' };
    }

    await client.query('UPDATE accounts SET balance_usd = balance_usd - $1 WHERE user_id = $2', [amount, userId]);

    const inserted = await client.query(
      `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, external_reference, metadata)
       VALUES ($1, 'withdrawal', $2, $3, 'sent', $4, $5)
       RETURNING id, amount_usd, status`,
      [userId, channel, amount, externalReference || null, metadata || {}]
    );

    await client.query('COMMIT');

    return { ok: true, transaction: inserted.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const investVault = async ({ userId, vaultId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vaultRes = await client.query('SELECT * FROM vault_catalog WHERE vault_id = $1', [vaultId]);
    const vault = vaultRes.rows[0];
    if (!vault) {
      await client.query('ROLLBACK');
      return { ok: false, code: 404, message: 'Vault tier not found' };
    }

    const activeRes = await client.query(
      "SELECT id FROM vault_investments WHERE user_id = $1 AND vault_id = $2 AND status = 'active'",
      [userId, vaultId]
    );

    if (activeRes.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, code: 400, message: 'Vault tier is already active.' };
    }

    const accountRes = await client.query('SELECT balance_usd FROM accounts WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(accountRes.rows[0]?.balance_usd || 0);
    const capital = Number(vault.capital_usd);

    if (balance < capital) {
      await client.query('ROLLBACK');
      return { ok: false, code: 400, message: 'Insufficient balance. Please deposit funds first.' };
    }

    await client.query('UPDATE accounts SET balance_usd = balance_usd - $1 WHERE user_id = $2', [capital, userId]);

    const activatedAt = new Date();
    const nextPayoutAt = nextSundayFromNowUtc(new Date());

    const investmentRes = await client.query(
      `INSERT INTO vault_investments (user_id, vault_id, status, capital_usd, weekly_roi_percent, activated_at, next_payout_at)
       VALUES ($1, $2, 'active', $3, $4, $5, $6)
       RETURNING id, vault_id, status, capital_usd, weekly_roi_percent, activated_at, next_payout_at`,
      [userId, vaultId, capital, Number(vault.weekly_roi_percent), activatedAt, nextPayoutAt]
    );

    await client.query(
      `INSERT INTO transactions (user_id, tx_type, channel, amount_usd, status, metadata)
       VALUES ($1, 'investment', 'vault', $2, 'completed', $3::jsonb)`,
      [
        userId,
        capital,
        JSON.stringify({ vaultId, vaultTitle: vault.title, tier: vault.tier }),
      ]
    );

    await client.query('COMMIT');

    return { ok: true, investment: investmentRes.rows[0], vault };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getVaultCatalog = async () => {
  const result = await pool.query('SELECT * FROM vault_catalog ORDER BY capital_usd ASC');
  return result.rows;
};

const registerWebhookEvent = async ({ provider, eventId, payload }) => {
  await pool.query(
    'INSERT INTO payment_webhooks (provider, event_id, payload) VALUES ($1, $2, $3::jsonb)',
    [provider, eventId || null, JSON.stringify(payload || {})]
  );
};

module.exports = {
  getSummary,
  createDepositRequest,
  markDepositCompleted,
  withdraw,
  investVault,
  getVaultCatalog,
  registerWebhookEvent,
};
