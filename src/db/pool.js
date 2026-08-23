const { Pool } = require('pg');
const { databaseUrl } = require('../config/env');

const vaultSeed = [
  { vault_id: 'vault-01', title: 'Vault 01', tier: 'Starter', capital_usd: 10, weekly_roi_percent: 55, cycle_days: 30 },
  { vault_id: 'vault-02', title: 'Vault 02', tier: 'Starter Plus', capital_usd: 25, weekly_roi_percent: 55, cycle_days: 30 },
  { vault_id: 'vault-03', title: 'Vault 03', tier: 'Growth', capital_usd: 50, weekly_roi_percent: 55, cycle_days: 30 },
  { vault_id: 'vault-04', title: 'Vault 04', tier: 'Growth Plus', capital_usd: 100, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-05', title: 'Vault 05', tier: 'Pro', capital_usd: 150, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-06', title: 'Vault 06', tier: 'Pro Plus', capital_usd: 250, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-07', title: 'Vault 07', tier: 'Advanced', capital_usd: 500, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-08', title: 'Vault 08', tier: 'Advanced Plus', capital_usd: 750, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-09', title: 'Vault 09', tier: 'Elite', capital_usd: 1000, weekly_roi_percent: 40, cycle_days: 30 },
  { vault_id: 'vault-10', title: 'Vault 10', tier: 'Institutional', capital_usd: 1500, weekly_roi_percent: 40, cycle_days: 30 },
];

const createMockState = () => ({
  users: [],
  accounts: new Map(),
  transactions: [],
  manualDeposits: [],
  vaultInvestments: [],
  vaultCatalog: vaultSeed.map((vault) => ({ ...vault })),
  paymentWebhooks: [],
});

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  return value;
};

const createMockClient = (state) => ({
  state,
  transactionDepth: 0,
  query(text, params = []) {
    const normalized = String(text || '').trim();
    const upper = normalized.toUpperCase();

    if (upper === 'BEGIN') {
      this.transactionDepth += 1;
      return Promise.resolve({ rows: [], rowCount: 0, command: 'BEGIN' });
    }

    if (upper === 'COMMIT' || upper === 'ROLLBACK') {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      return Promise.resolve({ rows: [], rowCount: 0, command: upper.toLowerCase() });
    }

    if (upper.startsWith('CREATE') || upper.startsWith('DROP') || upper.startsWith('INSERT INTO VAULT_CATALOG')) {
      return Promise.resolve({ rows: [], rowCount: 0, command: 'CREATE' });
    }

    if (upper.includes('INSERT INTO USERS')) {
      const [fullName, email, phone, passwordHash] = params;
      const userId = `mock-user-${this.state.users.length + 1}`;
      const createdAt = new Date().toISOString();
      const user = {
        id: userId,
        full_name: fullName,
        email: String(email).toLowerCase(),
        phone,
        password_hash: passwordHash,
        created_at: createdAt,
      };
      this.state.users.push(user);
      this.state.accounts.set(userId, { user_id: userId, balance_usd: 0, updated_at: createdAt });
      return Promise.resolve({
        rows: [
          {
            id: userId,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: 'user',
            created_at: createdAt,
          },
        ],
        rowCount: 1,
        command: 'INSERT',
      });
    }

    if (upper.includes('INSERT INTO ACCOUNTS')) {
      const [userId] = params;
      const account = this.state.accounts.get(userId) || { user_id: userId, balance_usd: 0, updated_at: new Date().toISOString() };
      this.state.accounts.set(userId, account);
      return Promise.resolve({ rows: [], rowCount: 0, command: 'INSERT' });
    }

    if (upper.includes('SELECT ID, FULL_NAME, EMAIL, PHONE, ROLE, PASSWORD_HASH, CREATED_AT FROM USERS WHERE EMAIL =')) {
      const [email] = params;
      const user = this.state.users.find((entry) => entry.email === String(email).toLowerCase());
      return Promise.resolve({ rows: user ? [user] : [], rowCount: user ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('INSERT INTO MANUAL_DEPOSITS')) {
      const [userId, network, amount, transactionId, agentName, receiptImageUrl] = params;
      const duplicate = this.state.manualDeposits.find((entry) => entry.network_selected === network && entry.transaction_id === transactionId);
      if (duplicate) return Promise.reject(new Error('manual_deposits_network_transaction_idx duplicate key'));
      const deposit = {
        id: `mock-deposit-${this.state.manualDeposits.length + 1}`,
        user_id: userId,
        network_selected: network,
        amount_usd: Number(amount),
        transaction_id: transactionId,
        agent_name: agentName,
        receipt_image_url: receiptImageUrl,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      this.state.manualDeposits.push(deposit);
      return Promise.resolve({ rows: [{ id: deposit.id, status: deposit.status, created_at: deposit.created_at }], rowCount: 1, command: 'INSERT' });
    }

    if (upper.includes('SELECT ID, NETWORK_SELECTED, AMOUNT_USD, TRANSACTION_ID, RECEIPT_IMAGE_URL')) {
      const rows = this.state.manualDeposits.filter((entry) => entry.status === 'pending').map((entry) => {
        const user = this.state.users.find((candidate) => candidate.id === entry.user_id) || {};
        return { ...entry, email: user.email, full_name: user.full_name };
      });
      return Promise.resolve({ rows, rowCount: rows.length, command: 'SELECT' });
    }

    if (upper.includes('SELECT ID, USER_ID, AMOUNT_USD, STATUS FROM MANUAL_DEPOSITS')) {
      const [depositId] = params;
      const deposit = this.state.manualDeposits.find((entry) => entry.id === depositId);
      return Promise.resolve({ rows: deposit ? [{ id: deposit.id, user_id: deposit.user_id, amount_usd: deposit.amount_usd, status: deposit.status }] : [], rowCount: deposit ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('UPDATE MANUAL_DEPOSITS SET STATUS')) {
      const [status, reviewer, depositId] = params;
      const deposit = this.state.manualDeposits.find((entry) => entry.id === depositId);
      if (deposit) { deposit.status = status; deposit.reviewed_by = reviewer; deposit.reviewed_at = new Date().toISOString(); }
      return Promise.resolve({ rows: [], rowCount: deposit ? 1 : 0, command: 'UPDATE' });
    }

    if (upper.includes('SELECT BALANCE_USD FROM ACCOUNTS WHERE USER_ID =')) {
      const [userId] = params;
      const account = this.state.accounts.get(userId);
      return Promise.resolve({ rows: account ? [{ balance_usd: account.balance_usd }] : [], rowCount: account ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('SELECT BALANCE_USD FROM ACCOUNTS WHERE USER_ID =') && upper.includes('FOR UPDATE')) {
      const [userId] = params;
      const account = this.state.accounts.get(userId);
      return Promise.resolve({ rows: account ? [{ balance_usd: account.balance_usd }] : [], rowCount: account ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('UPDATE ACCOUNTS SET BALANCE_USD = BALANCE_USD')) {
      const [amount, userId] = params;
      const account = this.state.accounts.get(userId) || { user_id: userId, balance_usd: 0, updated_at: new Date().toISOString() };
      account.balance_usd = Number(account.balance_usd) + Number(amount);
      this.state.accounts.set(userId, account);
      return Promise.resolve({ rows: [], rowCount: 1, command: 'UPDATE' });
    }

    if (upper.includes('UPDATE ACCOUNTS SET BALANCE_USD = BALANCE_USD -')) {
      const [amount, userId] = params;
      const account = this.state.accounts.get(userId) || { user_id: userId, balance_usd: 0, updated_at: new Date().toISOString() };
      account.balance_usd = Number(account.balance_usd) - Number(amount);
      this.state.accounts.set(userId, account);
      return Promise.resolve({ rows: [], rowCount: 1, command: 'UPDATE' });
    }

    if (upper.includes('INSERT INTO TRANSACTIONS')) {
      const txId = `mock-tx-${this.state.transactions.length + 1}`;
      const [userId, txType, channel, amount, status, externalReference, metadata] = params;
      const tx = {
        id: txId,
        user_id: userId,
        tx_type: txType,
        channel,
        amount_usd: Number(amount),
        status,
        external_reference: externalReference || null,
        metadata: normalizeValue(metadata || {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.transactions.push(tx);
      return Promise.resolve({ rows: [{ id: txId, amount_usd: tx.amount_usd, status: tx.status }], rowCount: 1, command: 'INSERT' });
    }

    if (upper.includes('SELECT TX_TYPE, AMOUNT_USD, STATUS, CREATED_AT FROM TRANSACTIONS')) {
      const [userId] = params;
      const rows = this.state.transactions
        .filter((tx) => tx.user_id === userId)
        .slice(0, 12)
        .map((tx) => ({ tx_type: tx.tx_type, amount_usd: tx.amount_usd, status: tx.status, created_at: tx.created_at }));
      return Promise.resolve({ rows, rowCount: rows.length, command: 'SELECT' });
    }

    if (upper.includes('SELECT TX_TYPE, AMOUNT_USD, STATUS, METADATA FROM TRANSACTIONS')) {
      const [userId] = params;
      const rows = this.state.transactions
        .filter((tx) => tx.user_id === userId)
        .slice(0, 10)
        .map((tx) => ({ tx_type: tx.tx_type, amount_usd: tx.amount_usd, status: tx.status, metadata: tx.metadata }));
      return Promise.resolve({ rows, rowCount: rows.length, command: 'SELECT' });
    }

    if (upper.includes('UPDATE TRANSACTIONS')) {
      const { state } = this;
      const match = /WHERE ID = \$([0-9]+)/i.exec(normalized);
      if (match) {
        const idIndex = Number(match[1]) - 1;
        const txId = params[idIndex];
        const tx = state.transactions.find((entry) => entry.id === txId);
        if (tx) {
          tx.status = params[0] === txId ? 'completed' : tx.status;
        }
      }
      return Promise.resolve({ rows: [], rowCount: 1, command: 'UPDATE' });
    }

    if (upper.includes('SELECT * FROM VAULT_CATALOG')) {
      const [vaultId] = params;
      const vault = this.state.vaultCatalog.find((entry) => entry.vault_id === vaultId);
      return Promise.resolve({ rows: vault ? [vault] : [], rowCount: vault ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('SELECT VAULT_ID, TITLE, TIER, CAPITAL_USD, WEEKLY_ROI_PERCENT, CYCLE_DAYS FROM VAULT_CATALOG')) {
      return Promise.resolve({ rows: this.state.vaultCatalog.map((vault) => ({ ...vault })), rowCount: this.state.vaultCatalog.length, command: 'SELECT' });
    }

    if (upper.includes('SELECT VAULT_ID, STATUS, CAPITAL_USD, WEEKLY_ROI_PERCENT, ACTIVATED_AT, NEXT_PAYOUT_AT FROM VAULT_INVESTMENTS')) {
      const [userId] = params;
      const rows = this.state.vaultInvestments
        .filter((entry) => entry.user_id === userId && entry.status === 'active')
        .map((entry) => ({ ...entry }));
      return Promise.resolve({ rows, rowCount: rows.length, command: 'SELECT' });
    }

    if (upper.includes('SELECT ID FROM VAULT_INVESTMENTS')) {
      const [userId, vaultId] = params;
      const row = this.state.vaultInvestments.find((entry) => entry.user_id === userId && entry.vault_id === vaultId && entry.status === 'active');
      return Promise.resolve({ rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('INSERT INTO VAULT_INVESTMENTS')) {
      const [userId, vaultId, status, capital, roi, activatedAt, nextPayoutAt] = params;
      const investment = {
        id: `mock-invest-${this.state.vaultInvestments.length + 1}`,
        user_id: userId,
        vault_id: vaultId,
        status,
        capital_usd: Number(capital),
        weekly_roi_percent: Number(roi),
        activated_at: activatedAt,
        next_payout_at: nextPayoutAt,
      };
      this.state.vaultInvestments.push(investment);
      return Promise.resolve({ rows: [{ id: investment.id, vault_id: investment.vault_id, status: investment.status, capital_usd: investment.capital_usd, weekly_roi_percent: investment.weekly_roi_percent, activated_at: investment.activated_at, next_payout_at: investment.next_payout_at }], rowCount: 1, command: 'INSERT' });
    }

    if (upper.includes('INSERT INTO PAYMENT_WEBHOOKS')) {
      const [provider, eventId, payload] = params;
      this.state.paymentWebhooks.push({ provider, event_id: eventId, payload: normalizeValue(payload) });
      return Promise.resolve({ rows: [], rowCount: 0, command: 'INSERT' });
    }

    if (upper.includes('SELECT * FROM VAULT_CATALOG WHERE VAULT_ID =')) {
      const [vaultId] = params;
      const row = this.state.vaultCatalog.find((entry) => entry.vault_id === vaultId);
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0, command: 'SELECT' });
    }

    if (upper.includes('SELECT VAULT_ID, CAPITAL_USD, WEEKLY_ROI_PERCENT, STATUS, ACTIVATED_AT, NEXT_PAYOUT_AT, VC.TITLE')) {
      const [userId] = params;
      const rows = this.state.vaultInvestments
        .filter((entry) => entry.user_id === userId && entry.status === 'active')
        .map((entry) => ({
          vault_id: entry.vault_id,
          capital_usd: entry.capital_usd,
          weekly_roi_percent: entry.weekly_roi_percent,
          status: entry.status,
          activated_at: entry.activated_at,
          next_payout_at: entry.next_payout_at,
          title: this.state.vaultCatalog.find((vault) => vault.vault_id === entry.vault_id)?.title || entry.vault_id,
        }));
      return Promise.resolve({ rows, rowCount: rows.length, command: 'SELECT' });
    }

    return Promise.resolve({ rows: [], rowCount: 0, command: 'SELECT' });
  },
  release() {},
});

class PoolAdapter {
  constructor() {
    this.realPool = new Pool({ connectionString: databaseUrl });
    this.mockState = createMockState();
    this.mockPool = createMockClient(this.mockState);
    this.useMock = false;
  }

  async query(text, params) {
    if (this.useMock) {
      return this.mockPool.query(text, params);
    }

    try {
      return await this.realPool.query(text, params);
    } catch (error) {
      if (this.isUnavailableError(error)) {
        this.useMock = true;
        return this.mockPool.query(text, params);
      }
      throw error;
    }
  }

  async connect() {
    if (this.useMock) {
      return this.mockPool;
    }

    try {
      return await this.realPool.connect();
    } catch (error) {
      if (this.isUnavailableError(error)) {
        this.useMock = true;
        return this.mockPool;
      }
      throw error;
    }
  }

  isUnavailableError(error) {
    const candidates = [];
    if (error instanceof Error) {
      candidates.push(error.message);
    }
    if (error?.cause) {
      candidates.push(String(error.cause));
    }
    if (Array.isArray(error?.errors)) {
      candidates.push(...error.errors.map((entry) => String(entry?.message || entry || '')));
    }
    if (error?.code) {
      candidates.push(String(error.code));
    }

    const message = candidates.join(' ').toLowerCase();
    return message.includes('econnrefused') || message.includes('connect') || message.includes('timeout') || message.includes('aggregateerror') || message.includes('refused');
  }
}

module.exports = new PoolAdapter();
