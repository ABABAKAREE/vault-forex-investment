const adminToken = localStorage.getItem('vaultAuthToken');
const adminList = document.getElementById('admin-deposit-list');
const statusTabs = document.querySelectorAll('[data-status-tab]');
let activeStatus = 'pending';

const renderDeposits = (deposits) => {
  if (!deposits.length) {
    adminList.innerHTML = `<div class="panel">No ${activeStatus} deposits.</div>`;
    return;
  }
  adminList.innerHTML = deposits.map((deposit) => `
    <article class="panel admin-deposit-card" data-deposit-id="${deposit.id}">
      <div class="admin-deposit-details">
        <p class="section-kicker">${deposit.network_selected}</p>
        <h2>${deposit.full_name || deposit.email}</h2>
        <p>${deposit.email}</p>
        <p><strong>$${Number(deposit.amount_usd).toFixed(2)}</strong> · Transaction ID: <strong>${deposit.transaction_id}</strong></p>
        <p class="admin-muted">Submitted ${new Date(deposit.created_at).toLocaleString()}</p>
        ${deposit.reviewed_at ? `<p class="admin-muted">Reviewed ${new Date(deposit.reviewed_at).toLocaleString()}</p>` : ''}
      </div>
      <img class="admin-receipt" src="${deposit.receipt_image_url}" alt="Receipt for ${deposit.transaction_id}" />
      ${deposit.status === 'pending' ? `<div class="admin-deposit-actions">
        <button class="primary-btn" type="button" data-review="approved">Approve</button>
        <button class="secondary-btn" type="button" data-review="rejected">Reject</button>
      </div>` : `<div class="admin-deposit-actions">
        <button class="danger-btn" type="button" data-delete>Delete</button>
      </div>`}
    </article>
  `).join('');
};

const loadDeposits = async () => {
  if (!adminToken) {
    adminList.innerHTML = '<div class="panel">Please sign in with an admin account.</div>';
    return;
  }
  const response = await fetch('/api/manual-deposits/all', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    adminList.innerHTML = `<div class="panel">${data.message || 'Unable to load pending deposits.'}</div>`;
    return;
  }
  const deposits = data.deposits || [];
  ['pending', 'approved', 'rejected'].forEach((status) => {
    const count = deposits.filter((deposit) => deposit.status === status).length;
    const countNode = document.querySelector(`[data-status-count="${status}"]`);
    if (countNode) countNode.textContent = count;
  });
  renderDeposits(deposits.filter((deposit) => deposit.status === activeStatus));
};

statusTabs.forEach((tab) => tab.addEventListener('click', () => {
  activeStatus = tab.dataset.statusTab;
  statusTabs.forEach((item) => item.classList.toggle('active', item === tab));
  loadDeposits();
}));

adminList?.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-delete]');
  const deleteCard = event.target.closest('[data-deposit-id]');
  if (deleteButton && deleteCard) {
    if (!window.confirm('Delete this deposit record permanently?')) return;
    deleteButton.disabled = true;
    try {
      const response = await fetch(`/api/manual-deposits/${deleteCard.dataset.depositId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        await loadDeposits();
      } else {
        deleteButton.disabled = false;
        alert(data.message || 'Deposit deletion failed.');
      }
    } catch (_error) {
      deleteButton.disabled = false;
      alert('Could not reach the server. Please try again.');
    }
    return;
  }

  const button = event.target.closest('[data-review]');
  const card = event.target.closest('[data-deposit-id]');
  if (!button || !card) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/manual-deposits/${card.dataset.depositId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      credentials: 'same-origin',
      body: JSON.stringify({ decision: button.dataset.review }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await loadDeposits();
    } else {
      button.disabled = false;
      alert(data.message || 'Deposit review failed.');
    }
  } catch (_error) {
    button.disabled = false;
    alert('Could not reach the server. Please try again.');
  }
});

loadDeposits();