const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

mobileMenuButton?.addEventListener('click', () => {
  mobileMenu?.classList.toggle('hidden');
});

const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');

sidebarToggle?.addEventListener('click', () => {
  const isOpen = sidebar?.classList.toggle('open');
  sidebarToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('vaultTheme');

if (savedTheme === 'light') {
  document.body.classList.add('light-theme');
}

if (themeToggle) {
  themeToggle.checked = document.body.classList.contains('light-theme');
  themeToggle.addEventListener('change', () => {
    const nextTheme = themeToggle.checked ? 'light' : 'dark';
    document.body.classList.toggle('light-theme', nextTheme === 'light');
    localStorage.setItem('vaultTheme', nextTheme);
  });
}

const languageSelector = document.getElementById('language-selector');
const savedLanguage = localStorage.getItem('vaultLanguage');

const translations = {
  en: { home: 'Home', marketplace: 'Marketplace', community: 'Community', mine: 'Mine', settings: 'Settings', account: 'My Account', language: 'Language', save: 'Save Profile Updates', fullName: 'Full Name', phone: 'Phone Number', email: 'Email Address', accountId: 'Account Number / ID', registrationDate: 'Registration Date', logout: 'Logout', logoutNow: 'Logout Now', transactions: 'Transactions', depositStatus: 'Deposit status', accountHistory: 'Account history' },
  sw: { home: 'Nyumbani', marketplace: 'Soko', community: 'Jamii', mine: 'Wasifu', settings: 'Mipangilio', account: 'Akaunti Yangu', language: 'Lugha', save: 'Hifadhi Mabadiliko ya Wasifu', fullName: 'Jina Kamili', phone: 'Namba ya Simu', email: 'Barua Pepe', accountId: 'Namba / Kitambulisho cha Akaunti', registrationDate: 'Tarehe ya Usajili', logout: 'Toka', logoutNow: 'Toka Sasa', transactions: 'Miamala', depositStatus: 'Hali ya amana', accountHistory: 'Historia ya akaunti' },
  fr: { home: 'Accueil', marketplace: 'Marché', community: 'Communauté', mine: 'Profil', settings: 'Paramètres', account: 'Mon compte', language: 'Langue', save: 'Enregistrer le profil', fullName: 'Nom complet', phone: 'Numéro de téléphone', email: 'Adresse e-mail', accountId: 'Numéro / ID du compte', registrationDate: "Date d'inscription", logout: 'Déconnexion', logoutNow: 'Se déconnecter', transactions: 'Transactions', depositStatus: 'Statut du dépôt', accountHistory: 'Historique du compte' },
};

const applyLanguage = (language) => {
  const selectedLanguage = translations[language] ? language : 'en';
  document.documentElement.lang = selectedLanguage;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const text = translations[selectedLanguage][node.dataset.i18n];
    if (text) node.textContent = text;
  });
  if (languageSelector) languageSelector.value = selectedLanguage;
};

applyLanguage(savedLanguage || 'en');
languageSelector?.addEventListener('change', () => {
  localStorage.setItem('vaultLanguage', languageSelector.value);
  applyLanguage(languageSelector.value);
});

const togglePasswordButton = document.getElementById('toggle-password');
const editPasswordButton = document.getElementById('edit-password');
const accountPassword = document.getElementById('account-password');
const AUTH_TOKEN_KEY = 'vaultAuthToken';
const AUTH_USER_KEY = 'vaultAuthUser';
const REFERRAL_LINK_KEY = 'vaultReferralLink';

const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';
const setAuthSession = (token, user) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || {}));
};
const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const protectedPages = ['home.html', 'dashboard.html', 'plans.html', 'my-account.html', 'settings.html', 'community.html'];
const STATIC_SERVER = 'http://localhost:3000';
const API_BASE_URL = window.location.protocol === 'file:'
  ? STATIC_SERVER
  : window.location.origin;

const initializeBottomNavigation = () => {
  document.querySelectorAll('.bottom-nav').forEach((nav) => {
    nav.innerHTML = `
      <a href="home.html" class="${currentPage === 'home.html' ? 'active' : ''}"><span class="nav-icon">⌂</span><span data-i18n="home">Home</span></a>
      <a href="plans.html" class="${currentPage === 'plans.html' ? 'active' : ''}"><span class="nav-icon">▦</span><span data-i18n="marketplace">Marketplace</span></a>
      <a href="community.html" class="${currentPage === 'community.html' ? 'active' : ''}"><span class="nav-icon">◎</span><span data-i18n="community">Community</span></a>
      <a href="my-account.html" class="${currentPage === 'my-account.html' ? 'active' : ''}"><span class="nav-icon">◉</span><span data-i18n="mine">Mine</span></a>
    `;
  });
  applyLanguage(localStorage.getItem('vaultLanguage') || 'en');
};

initializeBottomNavigation();

const hydrateProfile = () => {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
  } catch (_error) {
    user = {};
  }

  const fields = {
    'profile-full-name': user.full_name || user.name || '',
    'profile-email': user.email || '',
    'profile-phone': user.phone || '',
    'profile-account-id': user.id || '',
    'profile-created-at': user.created_at ? new Date(user.created_at).toLocaleDateString() : '',
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
};

hydrateProfile();


if (window.location.protocol === 'file:') {
  const redirectUrl = currentPage === 'index.html' ? STATIC_SERVER : `${STATIC_SERVER}/${currentPage}`;
  fetch(`${STATIC_SERVER}/api/health`, { method: 'HEAD', mode: 'cors' })
    .then((res) => {
      if (res.ok && window.location.href !== redirectUrl) {
        window.location.href = redirectUrl;
      }
    })
    .catch(() => {
      console.warn('Local server unavailable; continue in file mode.');
    });
}

if (protectedPages.includes(currentPage) && !getAuthToken()) {
  window.location.href = 'index.html';
}

const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        clearAuthSession();
        if (currentPage !== 'index.html') {
          window.location.href = 'index.html';
        }
      }

      return {
        ok: false,
        status: response.status,
        message: data?.message || 'Request failed',
      };
    }

    return data;
  } catch (error) {
    return { ok: false, message: 'Network error. Try again.' };
  }
};

const updateProfileFields = (user) => {
  const fields = {
    'profile-full-name': user.full_name || user.name || '',
    'profile-email': user.email || '',
    'profile-phone': user.phone || '',
    'profile-account-id': user.id || '',
    'profile-created-at': user.created_at ? new Date(user.created_at).toLocaleDateString() : '',
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
};

const hydrateProfileFromApi = async () => {
  if (!document.getElementById('profile-full-name') || !getAuthToken()) return;
  const result = await apiRequest('/api/account/profile');
  if (result?.ok && result.user) {
    updateProfileFields(result.user);
    setAuthSession(localStorage.getItem(AUTH_TOKEN_KEY), result.user);
  }
};

const initializeProfileSave = () => {
  const saveButton = document.getElementById('save-profile-updates');
  if (!saveButton) return;
  const feedback = document.getElementById('profile-feedback');
  saveButton.addEventListener('click', async () => {
    const fullName = document.getElementById('profile-full-name')?.value.trim();
    const phone = document.getElementById('profile-phone')?.value.trim();
    const password = document.getElementById('account-password')?.value || '';
    if (!fullName || (password && password.length < 8)) {
      feedback.textContent = 'Enter a full name and an optional password of at least 8 characters.';
      feedback.className = 'auth-feedback error';
      return;
    }
    saveButton.disabled = true;
    const result = await apiRequest('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone, password }),
    });
    saveButton.disabled = false;
    if (!result?.ok) {
      feedback.textContent = result?.message || 'Could not save profile updates.';
      feedback.className = 'auth-feedback error';
      return;
    }
    updateProfileFields(result.user);
    setAuthSession(localStorage.getItem(AUTH_TOKEN_KEY), result.user);
    if (document.getElementById('account-password')) document.getElementById('account-password').value = '';
    feedback.textContent = 'Profile updates saved.';
    feedback.className = 'auth-feedback success';
  });
};

hydrateProfileFromApi();
initializeProfileSave();

togglePasswordButton?.addEventListener('click', () => {
  if (!accountPassword) {
    return;
  }

  const nextType = accountPassword.type === 'password' ? 'text' : 'password';
  accountPassword.type = nextType;
  togglePasswordButton.textContent = nextType === 'password' ? 'Show' : 'Hide';
});

editPasswordButton?.addEventListener('click', () => {
  if (!accountPassword) {
    return;
  }

  const allowEdit = accountPassword.hasAttribute('readonly');
  if (allowEdit) {
    accountPassword.removeAttribute('readonly');
    accountPassword.focus();
    editPasswordButton.textContent = 'Lock';
  } else {
    accountPassword.setAttribute('readonly', 'readonly');
    editPasswordButton.textContent = 'Edit';
  }
});

const logoutButtons = document.querySelectorAll('[data-logout]');
logoutButtons.forEach((button) => {
  button.addEventListener('click', () => {
    clearAuthSession();
    window.location.href = 'index.html';
  });
});

const transactionModal = document.getElementById('transaction-modal');
const transactionModalTitle = document.getElementById('transaction-modal-title');
const transactionModalKicker = document.getElementById('transaction-modal-kicker');
const walletBalanceNode = document.getElementById('wallet-balance');
const recentActivityList = document.getElementById('recent-activity-list');
const manualDepositHistory = document.getElementById('manual-deposit-history');
const transactionHistory = document.getElementById('transaction-history');

const transactionState = {
  type: 'deposit',
  method: 'mpesa',
};

const BALANCE_STORAGE_KEY = 'vaultBalanceUsd';
const VAULT_ACTIVE_STORAGE_PREFIX = 'vaultActive:';
const VAULT_JOINED_STORAGE_PREFIX = 'vaultJoinedAt:';

const getStoredBalance = () => {
  const storedValue = Number(localStorage.getItem(BALANCE_STORAGE_KEY));
  if (Number.isFinite(storedValue) && storedValue >= 0) {
    return storedValue;
  }
  return 0;
};

const portfolioState = {
  balance: getStoredBalance(),
  recentActivities: [],
  manualDeposits: [],
  vaults: {},
};

const vaultCatalog = {
  'vault-01': { name: 'Vault 01', tier: 'Starter', capital: 10, roi: 17, totalProfit: 11.7 },
  'vault-02': { name: 'Vault 02', tier: 'Starter Plus', capital: 25, roi: 17, totalProfit: 29.25 },
  'vault-03': { name: 'Vault 03', tier: 'Growth', capital: 50, roi: 17, totalProfit: 58.5 },
  'vault-04': { name: 'Vault 04', tier: 'Growth Plus', capital: 100, roi: 18, totalProfit: 118 },
  'vault-05': { name: 'Vault 05', tier: 'Pro', capital: 150, roi: 18, totalProfit: 177 },
  'vault-06': { name: 'Vault 06', tier: 'Pro Plus', capital: 250, roi: 19, totalProfit: 397.25 },
  'vault-07': { name: 'Vault 07', tier: 'Advanced', capital: 500, roi: 20, totalProfit: 891.54 },
  'vault-08': { name: 'Vault 08', tier: 'Advanced Plus', capital: 750, roi: 21, totalProfit: 1435.9 },
  'vault-09': { name: 'Vault 09', tier: 'Elite', capital: 1000, roi: 22, totalProfit: 2080 },
  'vault-10': { name: 'Vault 10', tier: 'Institutional', capital: 1500, roi: 23, totalProfit: 3315 },
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatUsd = (value) => currencyFormatter.format(value);

const persistBalance = () => {
  localStorage.setItem(BALANCE_STORAGE_KEY, portfolioState.balance.toFixed(2));
};

const isVaultActive = (vaultId) => localStorage.getItem(`${VAULT_ACTIVE_STORAGE_PREFIX}${vaultId}`) === '1';
const setVaultActive = (vaultId, isActive) => {
  localStorage.setItem(`${VAULT_ACTIVE_STORAGE_PREFIX}${vaultId}`, isActive ? '1' : '0');
};

const getUpcomingSunday = (referenceDate = new Date()) => {
  const normalized = new Date(referenceDate);
  if (Number.isNaN(normalized.getTime())) {
    return null;
  }

  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const daysUntilSunday = (7 - day) % 7;
  normalized.setDate(normalized.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  return normalized;
};

const getNextPayoutDate = (joinedAt) => {
  const joinedDate = new Date(joinedAt);
  const now = new Date();

  if (Number.isNaN(joinedDate.getTime())) {
    return getUpcomingSunday(now);
  }

  const reference = joinedDate > now ? joinedDate : now;
  return getUpcomingSunday(reference);
};

const payoutDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const renderWalletBalance = () => {
  const balanceText = formatUsd(portfolioState.balance);
  if (walletBalanceNode) {
    walletBalanceNode.textContent = balanceText;
  }

  document.querySelectorAll('[data-total-balance]').forEach((node) => {
    node.textContent = balanceText;
  });
};

const renderRecentActivity = () => {
  if (!recentActivityList) {
    return;
  }

  const getStatusClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'pending') {
      return 'pending';
    }
    if (normalized === 'review') {
      return 'review';
    }
    return 'success';
  };

  recentActivityList.innerHTML = '';
  if (!portfolioState.recentActivities.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span>No transactions yet.</span><span class="status review">Waiting</span>';
    recentActivityList.appendChild(li);
    return;
  }

  portfolioState.recentActivities.slice(0, 5).forEach((entry) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${entry.title}</span><span class="status ${getStatusClass(entry.status)}">${entry.status}</span>`;
    recentActivityList.appendChild(li);
  });
};

const getHistoryStatusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'pending' ? 'pending' : normalized === 'completed' || normalized === 'approved' ? 'success' : 'review';
};

const renderAccountHistory = () => {
  const renderEmpty = (node, message) => {
    if (node) node.innerHTML = `<tr><td colspan="4" class="history-empty">${message}</td></tr>`;
  };
  const formatDate = (value) => new Date(value).toLocaleDateString();

  if (manualDepositHistory) {
    if (!portfolioState.manualDeposits.length) {
      renderEmpty(manualDepositHistory, 'No manual deposits yet.');
    } else {
      manualDepositHistory.innerHTML = portfolioState.manualDeposits.map((deposit) => `
        <tr><td>${formatDate(deposit.created_at)}</td><td>${deposit.network_selected}</td><td>${formatUsd(deposit.amount_usd)}</td>
        <td><span class="status ${getHistoryStatusClass(deposit.status)}">${deposit.status}</span></td></tr>
      `).join('');
    }
  }

  if (transactionHistory) {
    if (!portfolioState.recentActivities.length) {
      renderEmpty(transactionHistory, 'No transactions yet.');
    } else {
      transactionHistory.innerHTML = portfolioState.recentActivities.map((entry) => `
        <tr><td>${formatDate(entry.createdAt)}</td><td>${entry.title}</td><td>${entry.amount ? formatUsd(entry.amount) : '-'}</td>
        <td><span class="status ${getHistoryStatusClass(entry.status)}">${entry.status}</span></td></tr>
      `).join('');
    }
  }
};

const renderHomeActiveTiers = () => {
  const activeTierList = document.getElementById('active-tier-list');
  if (!activeTierList) {
    return;
  }

  const activeVaults = Object.entries(vaultCatalog).filter(([vaultId]) => isVaultActive(vaultId));
  if (!activeVaults.length) {
    activeTierList.innerHTML = '<li class="empty">No active tiers yet. Activate a vault from the Pledge tab.</li>';
    return;
  }

  activeTierList.innerHTML = activeVaults
    .map(([, vault]) => `<li><span>${vault.name} (${vault.tier})</span><strong>${formatUsd(vault.capital)}</strong></li>`)
    .join('');
};

const initializeReferralBox = () => {
  const referralInput = document.getElementById('referral-link');
  const copyButton = document.getElementById('copy-referral-link');
  if (!referralInput || !copyButton) {
    return;
  }

  const authUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
  const slug = String(authUser?.email || authUser?.id || 'member').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'member';
  const storedLink = localStorage.getItem(REFERRAL_LINK_KEY);
  const referralLink = storedLink || `https://vaultinvest.local/ref/${slug}`;
  referralInput.value = referralLink;
  localStorage.setItem(REFERRAL_LINK_KEY, referralLink);

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      copyButton.textContent = 'Copied';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1200);
    } catch (_error) {
      referralInput.select();
      document.execCommand('copy');
      copyButton.textContent = 'Copied';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1200);
    }
  });
};

const refreshDashboardUi = () => {
  renderWalletBalance();
  renderRecentActivity();
  renderAccountHistory();
  renderVaultCards();
  renderVaultActivationState();
  initializeVaultPayoutDates();
  renderHomeActiveTiers();
};

const prependActivity = (title, status) => {
  portfolioState.recentActivities.unshift({ title, status });
  portfolioState.recentActivities = portfolioState.recentActivities.slice(0, 10);
  renderRecentActivity();
};

const submitTransactionRequest = async (endpoint, payload) => {
  if (endpoint === '/api/payments/deposit' || endpoint === '/api/payments/withdraw') {
    const amount = Number(payload?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: 'Please enter a valid amount.' };
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      return { ok: false, status: 401, message: 'Please sign in again before submitting a transaction.' };
    }

    return await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (endpoint === '/api/vaults/invest') {
    const vault = vaultCatalog[payload?.vaultId];
    if (!vault) {
      return { ok: false, message: 'Vault not found.' };
    }

    if (portfolioState.balance < vault.capital) {
      return { ok: false, message: 'Insufficient balance for this vault.' };
    }

    portfolioState.balance -= vault.capital;
    persistBalance();
    setVaultActive(payload.vaultId, true);
    const card = document.querySelector(`[data-vault-id="${payload.vaultId}"]`);
    if (card) {
      card.dataset.joinedAt = new Date().toISOString();
    }
    prependActivity(`Invested in ${vault.name}`, 'Completed');
    return { ok: true, local: true };
  }

  return apiRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const hydratePortfolioFromApi = async () => {
  const savedBalance = Number(localStorage.getItem(BALANCE_STORAGE_KEY));
  if (Number.isFinite(savedBalance) && savedBalance >= 0) {
    portfolioState.balance = savedBalance;
  }

  const savedVaults = Object.keys(vaultCatalog).filter((vaultId) => localStorage.getItem(`${VAULT_ACTIVE_STORAGE_PREFIX}${vaultId}`) === '1');
  savedVaults.forEach((vaultId) => {
    setVaultActive(vaultId, true);
  });

  const token = getAuthToken();
  if (token) {
    const result = await apiRequest('/api/account/summary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (result?.ok) {
      portfolioState.balance = Number(result.balance || 0);
      portfolioState.recentActivities = Array.isArray(result.recentActivities) ? result.recentActivities : [];
      portfolioState.manualDeposits = Array.isArray(result.manualDeposits) ? result.manualDeposits : [];
      persistBalance();
    }
  }

  refreshDashboardUi();
};

let authFormInitialized = false;

const initializeAuthForm = () => {
  if (authFormInitialized) {
    return;
  }

  authFormInitialized = true;

  const authForm = document.getElementById('auth-form');
  const loginButton = document.getElementById('auth-login-btn');
  const registerButton = document.getElementById('auth-register-btn');
  const feedback = document.getElementById('auth-feedback');
  const fullNameInput = document.getElementById('auth-fullname');
  const phoneInput = document.getElementById('auth-phone');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const signupFields = document.getElementById('signup-fields');

  if (!authForm || !loginButton || !registerButton || !emailInput || !passwordInput || !feedback) {
    return;
  }

  const setFeedback = (message, type = 'info') => {
    feedback.textContent = message;
    feedback.classList.remove('success', 'error');
    if (type === 'success') {
      feedback.classList.add('success');
    }
    if (type === 'error') {
      feedback.classList.add('error');
    }
  };

  const authenticateLocally = ({ mode, fullName, email, password }) => {
    return authenticateLocalUser({
      mode,
      fullName,
      email,
      password,
      phone: phoneInput?.value || '',
    });
  };

  const setAuthMode = (mode) => {
    const isRegister = mode === 'register';
    signupFields?.classList.toggle('hidden', !isRegister);
    if (fullNameInput) {
      fullNameInput.required = isRegister;
    }
    if (isRegister) {
      fullNameInput?.focus();
      fullNameInput?.select();
      setFeedback('Create your account by filling your details below.', 'info');
      return;
    }

    emailInput?.focus();
    emailInput?.select();
    setFeedback('Enter your email and password to continue.', 'info');
  };

  const focusAuthField = (mode) => {
    if (mode === 'register') {
      setAuthMode('register');
      return;
    }

    if (emailInput.value.trim()) {
      passwordInput?.focus();
      passwordInput?.select();
      return;
    }

    emailInput?.focus();
    emailInput?.select();
  };

  const submitAuth = async (mode) => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const fullName = fullNameInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!email || !password) {
      setFeedback('Email and password are required.', 'error');
      focusAuthField(mode);
      return;
    }

    if (mode === 'register' && (!fullName || password.length < 8)) {
      setFeedback('For sign up, provide full name and password with at least 8 characters.', 'error');
      setAuthMode('register');
      return;
    }

    setFeedback(mode === 'register' ? 'Creating account...' : 'Signing in...');

    const result = await apiRequest(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'register'
        ? { fullName, email, password, phone }
        : { email, password }),
    });

    if (!result?.ok || !result?.token) {
      setFeedback(result?.message || 'Authentication failed.', 'error');
      return;
    }

    setAuthSession(result.token, result.user || {});
    setFeedback('Authentication successful. Redirecting to home...', 'success');
    window.location.replace('home.html');
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();

    const submitter = event.submitter;
    const action = submitter?.dataset?.authAction || 'login';

    if (action === 'register') {
      if (emailInput.value.trim() && passwordInput.value && fullNameInput?.value.trim()) {
        submitAuth('register');
        return;
      }
      focusAuthField('register');
      return;
    }

    if (emailInput.value.trim() && passwordInput.value) {
      submitAuth('login');
      return;
    }

    focusAuthField('login');
  };

  authForm.addEventListener('submit', handleFormSubmit);

  window.vaultHandleAuth = submitAuth;
  window.vaultSetAuthMode = setAuthMode;
};

const openTransactionModal = (action) => {
  if (!transactionModal || !transactionModalTitle || !transactionModalKicker) {
    return;
  }

  transactionState.type = action === 'withdraw' ? 'withdraw' : 'deposit';
  transactionState.method = 'mpesa';
  transactionModalTitle.textContent = transactionState.type === 'deposit' ? 'Deposit' : 'Withdraw';
  transactionModalKicker.textContent = transactionState.type === 'deposit' ? 'Secure Deposit Gateway' : 'Secure Withdrawal Gateway';
  continueTransactionButton?.setAttribute('disabled', 'disabled');
  paymentMethodButtons.forEach((item) => item.classList.remove('selected'));
  transactionModal.classList.remove('hidden');
  transactionModal.setAttribute('aria-hidden', 'false');
};

const closeTransactionModal = () => {
  if (!transactionModal) {
    return;
  }

  transactionModal.classList.add('hidden');
  transactionModal.setAttribute('aria-hidden', 'true');
};

const transactionButtons = document.querySelectorAll('[data-transaction-action]');
const closeModalButtons = document.querySelectorAll('[data-close-modal]');
const continueTransactionButton = document.getElementById('continue-transaction');

transactionButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const action = button.dataset.transactionAction || 'deposit';
    openTransactionModal(action);
  });
});

closeModalButtons.forEach((button) => {
  button.addEventListener('click', closeTransactionModal);
});

transactionModal?.addEventListener('click', (event) => {
  if (event.target === transactionModal) {
    closeTransactionModal();
  }
});

const paymentMethodButtons = document.querySelectorAll('[data-payment-method]');
const transactionFormModal = document.getElementById('transaction-form-modal');
const transactionForm = document.getElementById('transaction-form');
const transactionFormTitle = document.getElementById('transaction-form-title');
const transactionFormKicker = document.getElementById('transaction-form-kicker');
const transactionFormCopy = document.getElementById('transaction-form-copy');
const transactionAccountLabel = document.getElementById('transaction-account-label');
const transactionAccountInput = document.getElementById('transaction-account-input');
const transactionAmountInput = document.getElementById('transaction-amount-input');
const transactionReferenceLabel = document.getElementById('transaction-reference-label');
const transactionReferenceInput = document.getElementById('transaction-reference-input');
const transactionNote = document.getElementById('transaction-note');
const manualAccountPanel = document.getElementById('manual-account-panel');
const manualAccountName = document.getElementById('manual-account-name');
const manualAccountNumber = document.getElementById('manual-account-number');
const receiptField = document.getElementById('receipt-field');
const receiptInput = document.getElementById('receipt-input');
const closeFormModalButtons = document.querySelectorAll('[data-close-form-modal]');

const loadManualDepositNetwork = async (network) => {
  if (!manualAccountPanel || !manualAccountNumber) return;
  manualAccountPanel.classList.remove('hidden');
  manualAccountNumber.textContent = 'Loading...';
  const response = await apiRequest('/api/manual-deposits/networks');
  const details = response?.networks?.[network];
  if (response?.ok && details) {
    manualAccountName.textContent = response.accountName;
    manualAccountNumber.textContent = details.phone || 'Number not configured';
  } else {
    manualAccountNumber.textContent = 'Unable to load account number';
  }
};

document.getElementById('copy-manual-account')?.addEventListener('click', async () => {
  const value = manualAccountNumber?.textContent?.trim();
  if (!value || value === 'Loading...') return;
  await navigator.clipboard.writeText(value);
  const button = document.getElementById('copy-manual-account');
  if (button) {
    button.textContent = 'Copied';
    window.setTimeout(() => { button.textContent = 'Copy'; }, 1200);
  }
});

const openTransactionForm = () => {
  if (!transactionFormModal || !transactionFormTitle || !transactionFormKicker || !transactionFormCopy || !transactionAccountLabel || !transactionAccountInput || !transactionAmountInput || !transactionReferenceLabel || !transactionNote) {
    return;
  }

  const isDeposit = transactionState.type === 'deposit';
  const method = transactionState.method;
  const isMobile = method === 'mpesa' || method === 'tigo' || method === 'airtel';
  const isCrypto = method === 'usdt' || method === 'btc';
  const isBank = method === 'bank';

  transactionFormTitle.textContent = isDeposit ? 'Deposit Details' : 'Withdrawal Details';
  transactionFormKicker.textContent = method.toUpperCase();

  const accountRow = transactionAccountInput.closest('.field-group') || transactionAccountInput.parentElement;
  const referenceRow = transactionReferenceInput.closest('.transaction-reference-group') || transactionReferenceInput.parentElement;

  if (isDeposit && (isCrypto || isBank)) {
    // Only ask for amount — address/details shown in next modal
    if (accountRow) accountRow.style.display = 'none';
    if (referenceRow) referenceRow.style.display = 'none';
    transactionFormCopy.textContent = isBank
      ? 'Enter the amount you want to deposit. Bank account details will be shown next.'
      : `Enter the amount in USD. We will generate a ${method.toUpperCase()} deposit address for you.`;
    transactionNote.textContent = isBank
      ? 'After submitting, copy the bank details and make the transfer using your reference number.'
      : 'A unique deposit address will be generated. Send only the specified amount to that address.';
  } else {
    if (accountRow) accountRow.style.display = '';
    if (referenceRow) referenceRow.style.display = '';
    transactionAccountLabel.textContent = isDeposit
      ? isMobile ? 'Phone Number (e.g. 255712345678)' : 'Receiving Address / Account Number'
      : isMobile ? 'Phone Number to Receive Funds' : 'Crypto Address / Bank Account';
    transactionReferenceLabel.textContent = isDeposit ? 'Reference / Transaction ID' : 'Withdrawal Reference';
    transactionFormCopy.textContent = isDeposit
      ? 'Enter your phone number and amount to deposit. An STK push will be sent to your phone.'
      : 'Enter the receiving number/account and the amount to withdraw. Minimum is $5.';
    transactionNote.textContent = isMobile
      ? 'Check your phone for a payment prompt and enter your PIN to complete.'
      : 'Withdrawals are reviewed and sent within 1 business day.';
  }

  if (isDeposit && !isCrypto && !isBank) {
    if (accountRow) accountRow.style.display = 'none';
    if (referenceRow) referenceRow.style.display = '';
    transactionReferenceLabel.textContent = 'Transaction ID / Reference Number';
    transactionFormCopy.textContent = 'Send money to the account shown, then submit your transaction ID and receipt.';
    transactionNote.textContent = 'Your deposit will remain pending until an administrator verifies the receipt.';
    receiptField?.classList.remove('hidden');
    if (receiptInput) receiptInput.required = true;
    loadManualDepositNetwork(method);
  } else {
    manualAccountPanel?.classList.add('hidden');
    receiptField?.classList.add('hidden');
    if (receiptInput) receiptInput.required = false;
  }

  transactionAccountInput.value = '';
  transactionAmountInput.value = '';
  transactionReferenceInput.value = '';
  if (receiptInput) receiptInput.value = '';
  transactionFormModal.classList.remove('hidden');
  transactionFormModal.setAttribute('aria-hidden', 'false');
};

paymentMethodButtons.forEach((button) => {
  button.addEventListener('click', () => {
    paymentMethodButtons.forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    transactionState.method = button.dataset.paymentMethod || 'mpesa';
    continueTransactionButton?.removeAttribute('disabled');
  });
});

continueTransactionButton?.addEventListener('click', () => {
  closeTransactionModal();
  openTransactionForm();
});

closeFormModalButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (transactionFormModal) {
      transactionFormModal.classList.add('hidden');
      transactionFormModal.setAttribute('aria-hidden', 'true');
    }
  });
});

transactionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submittedForm = event.currentTarget;
  const submittedReferenceInput = submittedForm.elements.namedItem('transaction-reference-input');
  const submittedReceiptInput = submittedForm.elements.namedItem('receipt-input');
  const amount = Number(transactionAmountInput?.value || 0);
  const accountValue = transactionAccountInput?.value.trim();
  const referenceValue = submittedReferenceInput?.value.trim() || '';
  const method = transactionState.method;
  const isCrypto = method === 'usdt' || method === 'btc';
  const isBank = method === 'bank';

  if (Number.isNaN(amount) || amount <= 0) {
    return;
  }
  if (!isCrypto && !isBank && !accountValue) {
    if (transactionState.type !== 'deposit') return;
  }

  const closeForm = () => {
    if (transactionFormModal) {
      transactionFormModal.classList.add('hidden');
      transactionFormModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (transactionState.type === 'deposit' && !isCrypto && !isBank) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const receiptFile = submittedReceiptInput?.files?.[0];
    if (!token || !receiptFile) {
      alert(!token ? 'Please sign in again before submitting a deposit.' : 'Please select a receipt image before submitting.');
      return;
    }
    const transactionId = referenceValue || `PENDING-${Date.now()}`;
    const formData = new FormData();
    formData.append('networkSelected', method);
    formData.append('amount', String(amount));
    formData.append('transactionId', transactionId);
    formData.append('receipt', receiptFile, receiptFile.name);
    const submitButton = submittedForm.querySelector('#submit-transaction');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }
    try {
      const result = await fetch(`${API_BASE_URL}/api/manual-deposits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).then(async (response) => ({ ok: response.ok, ...(await response.json().catch(() => ({}))) }));
      if (result.ok) {
        submittedForm.reset();
        closeForm();
        await hydratePortfolioFromApi();
        alert('Deposit submitted. It is pending admin verification.');
      } else {
        alert(result.message || 'Could not submit manual deposit.');
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
      }
    }
    return;
  }

  // ── MOBILE MONEY DEPOSIT ─────────────────────────────────────────────
  if (transactionState.type === 'deposit') {
    const result = await submitTransactionRequest('/api/payments/deposit', {
      method,
      account: accountValue,
      amount,
      reference: referenceValue,
    });

    if (result?.ok !== false) {
      closeForm();
      await hydratePortfolioFromApi();
      alert(`STK push sent to ${accountValue}. Check your phone and enter your PIN to complete the deposit.`);

      if (queuedVaultAfterDeposit) {
        const queuedVault = vaultCatalog[queuedVaultAfterDeposit];
        if (queuedVault && portfolioState.balance >= queuedVault.capital) {
          const vaultToReopen = queuedVaultAfterDeposit;
          queuedVaultAfterDeposit = null;
          openVaultModal(vaultToReopen);
        }
      }
    } else if (result?.message) {
      alert(result.message);
    }
    return;
  }

  // ── WITHDRAWAL ────────────────────────────────────────────────────────
  if (amount < 5) {
    alert('Minimum withdrawal is $5.00.');
    return;
  }

  if (amount > portfolioState.balance) {
    alert('Insufficient balance. Please deposit funds first.');
    closeTransactionModal();
    openTransactionModal('deposit');
    return;
  }

  const result = await submitTransactionRequest('/api/payments/withdraw', {
    method,
    account: accountValue,
    amount,
    reference: referenceValue,
  });

  if (result?.ok !== false) {
    closeForm();
    await hydratePortfolioFromApi();
    if (isCrypto || isBank) {
      alert('Withdrawal request submitted. Funds will be sent to your address/account within 1 business day after review.');
    } else {
      alert(`Withdrawal initiated. Funds are being sent to ${accountValue}. This may take a few minutes.`);
    }
  } else if (result?.message) {
    alert(result.message);
  }
});

// ── Crypto address modal helpers ──────────────────────────────────────
const openCryptoAddressModal = (data, currencyLabel, amountUsd) => {
  const modal = document.getElementById('crypto-address-modal');
  if (!modal) return;
  const kicker = document.getElementById('crypto-address-kicker');
  const addrEl = document.getElementById('crypto-address-value');
  const amountEl = document.getElementById('crypto-pay-amount');
  const expireEl = document.getElementById('crypto-expire-note');

  if (kicker) kicker.textContent = `${currencyLabel} Deposit`;
  if (addrEl) addrEl.textContent = data.payAddress || '—';
  if (amountEl) amountEl.textContent = data.payAmount ? `${data.payAmount} ${(data.payCurrency || currencyLabel).toUpperCase()}` : `~${amountUsd} USD`;
  if (expireEl && data.expiresAt) {
    expireEl.textContent = `Address expires: ${new Date(data.expiresAt).toLocaleString()}`;
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
};

document.getElementById('close-crypto-modal')?.addEventListener('click', () => {
  const modal = document.getElementById('crypto-address-modal');
  if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
});

document.getElementById('copy-crypto-address')?.addEventListener('click', () => {
  const addr = document.getElementById('crypto-address-value')?.textContent;
  if (!addr || addr === '—') return;
  navigator.clipboard.writeText(addr).then(() => {
    const btn = document.getElementById('copy-crypto-address');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
  });
});

// ── Bank details modal helpers ────────────────────────────────────────
const openBankDetailsModal = async (amountUsd) => {
  const modal = document.getElementById('bank-details-modal');
  if (!modal) return;

  const list = document.getElementById('bank-details-list');
  if (list) list.innerHTML = '<dd>Loading bank details…</dd>';

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch('/api/payments/bank-deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ amount: amountUsd }),
    });
    const data = await res.json();

    if (list && data.ok) {
      const fields = [
        ['Bank', data.bank],
        ['Account Name', data.accountName],
        ['Account Number', data.accountNumber],
        ['Branch', data.branch],
        ['SWIFT / BIC', data.swiftCode],
        ['Amount', `$${amountUsd.toFixed(2)} USD`],
        ['Your Reference', data.reference],
      ];
      list.innerHTML = fields
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="bank-detail-row"><dt>${k}</dt><dd>${v}</dd></div>`)
        .join('');
    }
  } catch {
    if (list) list.innerHTML = '<dd>Could not load bank details. Please contact support.</dd>';
  }
};

document.getElementById('close-bank-modal')?.addEventListener('click', () => {
  const modal = document.getElementById('bank-details-modal');
  if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
});

const vaultModal = document.getElementById('vault-confirm-modal');
const vaultSummary = document.getElementById('vault-confirm-summary');
const closeVaultModalButtons = document.querySelectorAll('[data-close-vault-modal]');
const confirmVaultButton = document.getElementById('confirm-vault-button');
let pendingVaultId = null;
let queuedVaultAfterDeposit = null;

const renderVaultActivationState = () => {
  const cards = document.querySelectorAll('[data-vault-id]');
  cards.forEach((card) => {
    const vaultId = card.dataset.vaultId;
    if (!vaultId) {
      return;
    }

    const button = card.querySelector('[data-invest-btn]');
    const cycleDays = Number(card.dataset.payoutCycleDays || 7);
    const isActive = isVaultActive(vaultId);
    let statusNode = card.querySelector('[data-vault-status]');
    if (!statusNode) {
      statusNode = document.createElement('p');
      statusNode.className = 'vault-activation';
      statusNode.setAttribute('data-vault-status', 'true');
      card.appendChild(statusNode);
    }

    if (!isActive) {
      statusNode.classList.remove('active');
      statusNode.classList.add('inactive');
      statusNode.textContent = 'Status: Locked tier';
      if (button) {
        button.disabled = false;
        button.textContent = 'INVEST NOW';
      }
      return;
    }

    const joinedAt = card.dataset.joinedAt;
    const nextPayout = getNextPayoutDate(joinedAt, cycleDays);
    statusNode.classList.remove('inactive');
    statusNode.classList.add('active');
    statusNode.textContent = `Status: Active | Next payout ${nextPayout ? payoutDateFormatter.format(nextPayout) : 'Unavailable'}`;
    if (button) {
      button.disabled = true;
      button.textContent = 'TIER ACTIVE';
    }
  });
};

const openVaultModal = (vaultId) => {
  const vault = vaultCatalog[vaultId];
  if (!vault || !vaultModal || !vaultSummary) {
    return;
  }

  pendingVaultId = vaultId;
  const card = document.querySelector(`[data-vault-id="${vaultId}"]`);
  const cycleDays = Number(card?.dataset.payoutCycleDays || 7);
  const joinedAt = card?.dataset.joinedAt || new Date().toISOString();
  const nextPayout = getNextPayoutDate(joinedAt, cycleDays);
  const active = isVaultActive(vaultId);

  vaultSummary.innerHTML = `
    <p><strong>${vault.name}</strong></p>
    <p>Tier: <strong>${vault.tier}</strong></p>
    <p>Capital Required: <strong>${formatUsd(vault.capital)}</strong></p>
    <p>Weekly ROI: <strong>${vault.roi}%</strong></p>
    <p>Expected Total Payout: <strong>${formatUsd(vault.totalProfit)}</strong></p>
    <p>Current Balance: <strong>${formatUsd(portfolioState.balance)}</strong></p>
    <p>Projected Next Payout: <strong>${nextPayout ? payoutDateFormatter.format(nextPayout) : payoutDateFormatter.format(getUpcomingSunday(new Date()))}</strong></p>
    <p>Status: <strong>${active ? 'Active' : 'Locked'}</strong></p>
  `;

  if (confirmVaultButton) {
    confirmVaultButton.disabled = active;
    confirmVaultButton.textContent = active ? 'Tier Active' : 'CONFIRM INVESTMENT';
  }

  vaultModal.classList.remove('hidden');
  vaultModal.setAttribute('aria-hidden', 'false');
};

const closeVaultModal = () => {
  if (!vaultModal) {
    return;
  }

  vaultModal.classList.add('hidden');
  vaultModal.setAttribute('aria-hidden', 'true');
};

const vaultActionContainers = document.querySelectorAll('#vault-grid, .vault-catalog');
vaultActionContainers.forEach((container) => {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-invest-btn]');
    if (!button || button.disabled) {
      return;
    }

    const vaultCard = button.closest('[data-vault-id]');
    if (!vaultCard) {
      return;
    }

    openVaultModal(vaultCard.dataset.vaultId || '');
  });
});

closeVaultModalButtons.forEach((button) => {
  button.addEventListener('click', closeVaultModal);
});

vaultModal?.addEventListener('click', (event) => {
  if (event.target === vaultModal) {
    closeVaultModal();
  }
});

confirmVaultButton?.addEventListener('click', () => {
  if (!pendingVaultId) {
    return;
  }

  const vault = vaultCatalog[pendingVaultId];
  if (!vault) {
    return;
  }

  if (isVaultActive(pendingVaultId)) {
    return;
  }

  if (portfolioState.balance < vault.capital) {
    queuedVaultAfterDeposit = pendingVaultId;
    closeVaultModal();
    if (transactionModal) {
      openTransactionModal('deposit');
    } else {
      window.location.href = 'home.html';
    }
    return;
  }

  submitTransactionRequest('/api/vaults/invest', {
    vaultId: pendingVaultId,
  }).then((result) => {
    if (result?.ok !== false) {
      closeVaultModal();
      hydratePortfolioFromApi();
    } else if (result?.message) {
      alert(result.message);
    }
  });
});

const renderVaultCards = () => {
  const vaultGrid = document.getElementById('vault-grid');
  if (!vaultGrid) {
    return;
  }

  const featuredOnly = vaultGrid.dataset.featuredOnly === 'true';
  const vaultEntries = Object.entries(vaultCatalog);
  const entriesToRender = featuredOnly ? vaultEntries.slice(0, 3) : vaultEntries;

  vaultGrid.innerHTML = entriesToRender
    .map(([vaultId, vault]) => {
      const joinedAt = localStorage.getItem(`${VAULT_JOINED_STORAGE_PREFIX}${vaultId}`) || new Date().toISOString();
      const isActive = isVaultActive(vaultId);
      return `
        <article class="panel vault-card" data-vault-id="${vaultId}" data-joined-at="${joinedAt}" data-payout-cycle-days="7">
          <span class="promo-badge">${vault.tier.toUpperCase()}</span>
          <h3>${vault.name.toUpperCase()}</h3>
          <p class="vault-row"><span>Capital</span><span>${formatUsd(vault.capital)}</span></p>
          <p class="vault-row"><span>Weekly ROI</span><span>${vault.roi}%</span></p>
          <p class="vault-row"><span>Total Profit</span><span>${formatUsd(vault.totalProfit)}</span></p>
          <p class="vault-date">Next Payout: <span data-next-payout></span></p>
          <p class="vault-activation ${isActive ? 'active' : 'inactive'}" data-vault-status>${isActive ? 'Status: Active' : 'Status: Locked tier'}</p>
          <button class="vault-btn" type="button" data-invest-btn>${isActive ? 'TIER ACTIVE' : 'INVEST NOW'}</button>
        </article>
      `;
    })
    .join('');

  renderVaultActivationState();
  initializeVaultPayoutDates();
};

renderWalletBalance();
renderRecentActivity();
renderVaultCards();

function initializeMarketCarousel() {
  const track = document.getElementById('market-carousel-track');
  if (!track) {
    return;
  }

  const slides = track.querySelectorAll('.carousel-slide');
  if (!slides.length) {
    return;
  }

  const dotsContainer = document.getElementById('market-carousel-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, slideIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show market slide ${slideIndex + 1}`);
      dot.className = `dot${slideIndex === 0 ? ' active' : ''}`;
      dotsContainer.appendChild(dot);
    });
  }

  const dots = dotsContainer ? dotsContainer.querySelectorAll('.dot') : [];
  let index = 0;
  let timerId;
  let resumeTimerId;

  const updateCarousel = () => {
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle('active', dotIndex === index);
    });
  };

  const syncActiveDot = () => {
    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    if (nextIndex !== index && nextIndex >= 0 && nextIndex < slides.length) {
      index = nextIndex;
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === index);
      });
    }
  };

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => {
      index = dotIndex;
      updateCarousel();
      startAutoSlide();
    });
  });

  track.addEventListener('scroll', syncActiveDot, { passive: true });

  const startAutoSlide = () => {
    window.clearInterval(timerId);
    timerId = window.setInterval(() => {
      index = (index + 1) % slides.length;
      updateCarousel();
    }, 5000);
  };

  const pauseAutoSlide = () => {
    window.clearInterval(timerId);
    window.clearTimeout(resumeTimerId);
  };

  const resumeAutoSlide = () => {
    window.clearTimeout(resumeTimerId);
    resumeTimerId = window.setTimeout(startAutoSlide, 3000);
  };

  track.addEventListener('mouseenter', pauseAutoSlide);
  track.addEventListener('mouseleave', resumeAutoSlide);
  track.addEventListener('touchstart', pauseAutoSlide, { passive: true });
  track.addEventListener('touchend', resumeAutoSlide, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAutoSlide();
    else startAutoSlide();
  });

  updateCarousel();
  startAutoSlide();

}

function initializeTradingViewWidgets() {
  const cards = document.querySelectorAll('[data-market-symbol]');
  if (!cards.length) {
    return;
  }

  const formatDate = (date) => date.toISOString().slice(0, 10);
  const formatPrice = (price, quote) => quote === 'JPY' ? price.toFixed(3) : price.toFixed(5);

  const renderPairChart = (card) => {
    const widgetHost = card.querySelector('[data-tv-widget]');
    const symbol = card.dataset.marketSymbol;
    if (!widgetHost || !symbol || typeof TradingView === 'undefined') {
      return;
    }

    const hostId = `tv-${symbol.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    widgetHost.id = hostId;
    new TradingView.widget({
      autosize: true,
      symbol,
      interval: '30',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      hide_top_toolbar: true,
      hide_legend: true,
      withdateranges: false,
      allow_symbol_change: false,
      save_image: false,
      container_id: hostId,
    });
  };

  const fetchPairData = async (card) => {
    const ticker = card.dataset.marketTicker;
    const priceNode = card.querySelector('[data-pair-price]');
    if (!priceNode || !ticker) {
      return;
    }

    const from = ticker.slice(0, 3);
    const to = ticker.slice(3, 6);
    if (!card.dataset.chartInitialized) {
      renderPairChart(card);
      card.dataset.chartInitialized = 'true';
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 14);
    const latestUrl = `https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`;
    const historyUrl = `https://api.frankfurter.dev/v1/${formatDate(startDate)}..${formatDate(endDate)}?from=${from}&to=${to}`;

    priceNode.textContent = 'Fetching...';
    try {
      const [latestResponse, historyResponse] = await Promise.all([fetch(latestUrl), fetch(historyUrl)]);
      if (!latestResponse.ok || !historyResponse.ok) {
        throw new Error('Market data unavailable');
      }

      const [latest, history] = await Promise.all([latestResponse.json(), historyResponse.json()]);
      const price = Number(latest?.rates?.[to]);
      const values = Object.keys(history?.rates || {})
        .sort()
        .map((date) => Number(history.rates[date]?.[to]));
      if (!Number.isFinite(price) || values.length < 2) {
        throw new Error('Invalid market data');
      }

      priceNode.textContent = formatPrice(price, to);
      priceNode.classList.remove('bearish', 'neutral');
      priceNode.classList.add('bullish');
    } catch (_error) {
      priceNode.textContent = 'Unavailable';
      priceNode.classList.remove('bullish', 'bearish');
      priceNode.classList.add('neutral');
    }
  };

  cards.forEach((card, index) => {
    window.setTimeout(() => fetchPairData(card), index * 250);
  });
}

function initializeMarketStatusIndicator() {
  const marketBadge = document.getElementById('market-open-badge');
  const countdownNode = document.getElementById('market-countdown');
  if (!marketBadge || !countdownNode) {
    return;
  }

  const isOpen = (dateUtc) => {
    const day = dateUtc.getUTCDay();
    const hour = dateUtc.getUTCHours() + dateUtc.getUTCMinutes() / 60;
    if (day >= 1 && day <= 4) {
      return true;
    }
    if (day === 0 && hour >= 22) {
      return true;
    }
    if (day === 5 && hour < 22) {
      return true;
    }
    return false;
  };

  const nextFridayClose = (now) => {
    const close = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22, 0, 0));
    const day = now.getUTCDay();
    const daysUntilFriday = (5 - day + 7) % 7;
    close.setUTCDate(close.getUTCDate() + daysUntilFriday);
    if (close <= now) {
      close.setUTCDate(close.getUTCDate() + 7);
    }
    return close;
  };

  const nextSundayOpen = (now) => {
    const open = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22, 0, 0));
    const day = now.getUTCDay();
    const daysUntilSunday = (7 - day) % 7;
    open.setUTCDate(open.getUTCDate() + daysUntilSunday);
    if (day === 0 && open <= now) {
      open.setUTCDate(open.getUTCDate() + 7);
    }
    return open;
  };

  const formatRemaining = (ms) => {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const render = () => {
    const now = new Date();
    if (isOpen(now)) {
      const closeAt = nextFridayClose(now);
      marketBadge.textContent = 'OPEN';
      marketBadge.classList.add('open');
      marketBadge.classList.remove('closed');
      countdownNode.textContent = `Closes in ${formatRemaining(closeAt.getTime() - now.getTime())}`;
    } else {
      const openAt = nextSundayOpen(now);
      marketBadge.textContent = 'CLOSED';
      marketBadge.classList.add('closed');
      marketBadge.classList.remove('open');
      countdownNode.textContent = `Reopens in ${formatRemaining(openAt.getTime() - now.getTime())}`;
    }
  };

  render();
  setInterval(render, 60000);
}

function initializeWeeklyMarketStats() {
  const sentimentNode = document.getElementById('weekly-sentiment');
  const rowTargets = {
    eurusd: document.getElementById('wk-eurusd'),
    gbpusd: document.getElementById('wk-gbpusd'),
    usdjpy: document.getElementById('wk-usdjpy'),
    usdcad: document.getElementById('wk-usdcad'),
  };

  if (!sentimentNode || !rowTargets.eurusd) {
    return;
  }

  const pairChanges = {
    eurusd: 0.18,
    gbpusd: -0.07,
    usdjpy: 0.34,
    usdcad: -0.15,
  };

  const formatSignedPercent = (value) => (value >= 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`);

  const setTrendClass = (node, value) => {
    node.classList.remove('bullish', 'bearish', 'neutral');
    if (value > 0.1) {
      node.classList.add('bullish');
    } else if (value < -0.1) {
      node.classList.add('bearish');
    } else {
      node.classList.add('neutral');
    }
  };

  rowTargets.eurusd.textContent = formatSignedPercent(pairChanges.eurusd);
  rowTargets.gbpusd.textContent = formatSignedPercent(pairChanges.gbpusd);
  rowTargets.usdjpy.textContent = formatSignedPercent(pairChanges.usdjpy);
  rowTargets.usdcad.textContent = formatSignedPercent(pairChanges.usdcad);

  setTrendClass(rowTargets.eurusd, pairChanges.eurusd);
  setTrendClass(rowTargets.gbpusd, pairChanges.gbpusd);
  setTrendClass(rowTargets.usdjpy, pairChanges.usdjpy);
  setTrendClass(rowTargets.usdcad, pairChanges.usdcad);

  const average = Object.values(pairChanges).reduce((sum, value) => sum + value, 0) / Object.values(pairChanges).length;
  let sentimentText = 'Neutral weekly direction';
  let sentimentClass = 'neutral';
  if (average > 0.12) {
    sentimentText = 'Bullish weekly direction';
    sentimentClass = 'bullish';
  } else if (average < -0.12) {
    sentimentText = 'Bearish weekly direction';
    sentimentClass = 'bearish';
  }

  sentimentNode.textContent = `${sentimentText} · 3 pairs active`;
  sentimentNode.classList.remove('bullish', 'bearish', 'neutral');
  sentimentNode.classList.add(sentimentClass);
}

function initializeVaultPayoutDates() {
  const vaultCards = document.querySelectorAll('[data-vault-id]');
  if (!vaultCards.length) {
    return;
  }

  const renderCardPayout = (card) => {
    const payoutNode = card.querySelector('[data-next-payout]');
    if (!payoutNode) {
      return;
    }

    const cycleDays = Number(card.dataset.payoutCycleDays || 7);
    const joinedAt = card.dataset.joinedAt;
    const payoutDate = getNextPayoutDate(joinedAt, cycleDays);
    payoutNode.textContent = payoutDate ? payoutDateFormatter.format(payoutDate) : 'Unavailable';
  };

  vaultCards.forEach((card) => {
    const vaultId = card.dataset.vaultId;
    if (!vaultId) {
      return;
    }

    const savedJoinedAt = localStorage.getItem(`${VAULT_JOINED_STORAGE_PREFIX}${vaultId}`);
    if (savedJoinedAt) {
      card.dataset.joinedAt = savedJoinedAt;
    } else if (!isVaultActive(vaultId)) {
      // For inactive tiers, always preview payout from current week instead of old hardcoded dates.
      card.dataset.joinedAt = new Date().toISOString();
    }

    renderCardPayout(card);
  });

  renderVaultActivationState();
}

initializeMarketCarousel();
initializeTradingViewWidgets();
initializeMarketStatusIndicator();
initializeWeeklyMarketStats();
initializeVaultPayoutDates();
hydratePortfolioFromApi();
initializeReferralBox();
renderHomeActiveTiers();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuthForm, { once: true });
} else {
  initializeAuthForm();
}
