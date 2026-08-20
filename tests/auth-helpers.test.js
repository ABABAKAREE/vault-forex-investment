const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureDefaultDemoAccount, authenticateLocalUser } = require('../assets/js/auth-helpers.js');

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test('seeds a demo account when no users exist', () => {
  const storage = createMemoryStorage();
  const users = ensureDefaultDemoAccount(storage);

  assert.equal(users.length, 0);
});

test('rejects login when no account exists', () => {
  const storage = createMemoryStorage();
  const result = authenticateLocalUser({ mode: 'login', email: 'missing@vaultinvest.com', password: 'secret123' }, storage);
  assert.equal(result.ok, false);
});

test('registers a new account and allows login', () => {
  const storage = createMemoryStorage();

  const created = authenticateLocalUser({ mode: 'register', fullName: 'New User', email: 'new@vaultinvest.com', password: 'newpass123', phone: '255700000000' }, storage);
  assert.equal(created.ok, true);

  const loggedIn = authenticateLocalUser({ mode: 'login', email: 'new@vaultinvest.com', password: 'newpass123' }, storage);
  assert.equal(loggedIn.ok, true);
  assert.equal(loggedIn.user.email, 'new@vaultinvest.com');
});

test('exposes auth helpers globally for browser scripts', () => {
  globalThis.authenticateLocalUser = undefined;
  globalThis.ensureDefaultDemoAccount = undefined;

  delete require.cache[require.resolve('../assets/js/auth-helpers.js')];
  require('../assets/js/auth-helpers.js');

  assert.equal(typeof globalThis.authenticateLocalUser, 'function');
  assert.equal(typeof globalThis.ensureDefaultDemoAccount, 'function');
});
