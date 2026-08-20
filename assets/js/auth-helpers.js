const AUTH_USERS_STORAGE_KEY = 'vaultLocalUsers';

function getStoredUsers(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(AUTH_USERS_STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function saveStoredUsers(users, storage = localStorage) {
  storage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users));
}

function ensureDefaultDemoAccount(storage = localStorage) {
  const users = getStoredUsers(storage).filter(Boolean);
  return getStoredUsers(storage).filter(Boolean);
}

function authenticateLocalUser({ mode, fullName, email, password, phone }, storage = localStorage) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let users = getStoredUsers(storage).filter(Boolean);

  if (mode === 'register') {
    const existingUser = users.find((entry) => String(entry?.email || '').toLowerCase() === normalizedEmail);
    if (existingUser) {
      return { ok: false, message: 'An account with this email already exists.' };
    }

    const user = {
      id: `local-${Date.now()}`,
      full_name: String(fullName || '').trim(),
      email: normalizedEmail,
      phone: String(phone || '').trim() || '',
      password: String(password || ''),
      created_at: new Date().toISOString(),
    };

    users.push(user);
    saveStoredUsers(users, storage);

    return { ok: true, token: `local-${Date.now()}`, user };
  }

  const existingUser = users.find((entry) => String(entry?.email || '').toLowerCase() === normalizedEmail && String(entry?.password || '') === String(password || ''));
  if (!existingUser) {
    return { ok: false, message: 'No matching local account found. Please create one first.' };
  }

  return {
    ok: true,
    token: `local-${Date.now()}`,
    user: {
      id: existingUser.id,
      full_name: existingUser.full_name || existingUser.name || existingUser.email,
      email: existingUser.email,
      phone: existingUser.phone || '',
      created_at: existingUser.created_at || new Date().toISOString(),
    },
  };
}

const exposeAuthHelpers = (target) => {
  target.authenticateLocalUser = authenticateLocalUser;
  target.ensureDefaultDemoAccount = ensureDefaultDemoAccount;
  target.getStoredUsers = getStoredUsers;
  target.saveStoredUsers = saveStoredUsers;
};

if (typeof globalThis !== 'undefined') {
  exposeAuthHelpers(globalThis);
}

if (typeof window !== 'undefined') {
  exposeAuthHelpers(window);
}

if (typeof module !== 'undefined') {
  module.exports = {
    AUTH_USERS_STORAGE_KEY,
    getStoredUsers,
    saveStoredUsers,
    ensureDefaultDemoAccount,
    authenticateLocalUser,
  };
}
