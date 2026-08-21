const pool = require('./pool');

const migrationSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_catalog (
  vault_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tier TEXT NOT NULL,
  capital_usd NUMERIC(14,2) NOT NULL,
  weekly_roi_percent NUMERIC(6,2) NOT NULL,
  cycle_days INT NOT NULL DEFAULT 7
);

CREATE TABLE IF NOT EXISTS vault_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vault_id TEXT NOT NULL REFERENCES vault_catalog(vault_id),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  capital_usd NUMERIC(14,2) NOT NULL,
  weekly_roi_percent NUMERIC(6,2) NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_payout_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, vault_id, status)
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('deposit', 'withdrawal', 'investment', 'payout')),
  channel TEXT,
  amount_usd NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'sent')) DEFAULT 'pending',
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network_selected TEXT NOT NULL CHECK (network_selected IN ('mpesa', 'tigo', 'airtel', 'halopesa')),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  transaction_id TEXT NOT NULL,
  receipt_image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS manual_deposits_network_transaction_idx
ON manual_deposits (network_selected, transaction_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
`;

const seedSql = `
INSERT INTO vault_catalog (vault_id, title, tier, capital_usd, weekly_roi_percent, cycle_days) VALUES
('vault-01', 'Vault 01', 'Starter', 10, 17, 7),
('vault-02', 'Vault 02', 'Starter Plus', 25, 17, 7),
('vault-03', 'Vault 03', 'Growth', 50, 17, 7),
('vault-04', 'Vault 04', 'Growth Plus', 100, 18, 7),
('vault-05', 'Vault 05', 'Pro', 150, 18, 7),
('vault-06', 'Vault 06', 'Pro Plus', 250, 19, 7),
('vault-07', 'Vault 07', 'Advanced', 500, 20, 7),
('vault-08', 'Vault 08', 'Advanced Plus', 750, 21, 7),
('vault-09', 'Vault 09', 'Elite', 1000, 22, 7),
('vault-10', 'Vault 10', 'Institutional', 1500, 23, 7)
ON CONFLICT (vault_id) DO NOTHING;
`;

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query(seedSql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { migrate };
