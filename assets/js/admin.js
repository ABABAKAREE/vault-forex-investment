const adminToken = localStorage.getItem('vaultAuthToken');
const adminList = document.getElementById('admin-deposit-list');

const loadPendingDeposits = async () => {
  if (!adminToken) {
    adminList.innerHTML = '<div class="panel">Please sign in with an admin account.</div>';
    return;
  }
  const response = await fetch('/api/manual-deposits/pending', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    adminList.innerHTML = `<div class="panel">${data.message || 'Unable to load pending deposits.'}</div>`;
    return;
  }
  if (!data.deposits?.length) {
    adminList.innerHTML = '<div class="panel">No pending deposits.</div>';
    return;
  }
  adminList.innerHTML = data.deposits.map((deposit) => `
    <article class="panel admin-deposit-card" data-deposit-id="${deposit.id}">
      <div class="admin-deposit-details">
        <p class="section-kicker">${deposit.network_selected}</p>
        <h2>${deposit.full_name || deposit.email}</h2>
        <p>${deposit.email}</p>
        <p><strong>$${Number(deposit.amount_usd).toFixed(2)}</strong> · Transaction ID: <strong>${deposit.transaction_id}</strong></p>
        <p class="admin-muted">Submitted ${new Date(deposit.created_at).toLocaleString()}</p>
      </div>
      <img class="admin-receipt" src="${deposit.receipt_image_url}" alt="Receipt for ${deposit.transaction_id}" />
      <div class="admin-deposit-actions">
        <button class="primary-btn" type="button" data-review="approved">Approve</button>
        <button class="secondary-btn" type="button" data-review="rejected">Reject</button>
      </div>
    </article>
  `).join('');
};

adminList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-review]');
  const card = event.target.closest('[data-deposit-id]');
  if (!button || !card) return;
  button.disabled = true;
  const response = await fetch(`/api/manual-deposits/${card.dataset.depositId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: button.dataset.review }),
  });
  if (response.ok) card.remove();
  else button.disabled = false;
});

loadPendingDeposits();