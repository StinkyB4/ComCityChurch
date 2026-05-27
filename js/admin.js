/**
 * COMMISSIONED CITY CHURCH — ADMIN PANEL
 * Requires admin role. Loads all member profiles, supports approve/deactivate/role-change.
 */

let allMembers = [];
let currentFilter = 'pending';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof initSupabase !== 'undefined') await initSupabase();

    const profile = await requireAdmin('/members/');
    if (!profile) return;

    await loadAllMembers();
  } catch (err) {
    console.error('Admin init error:', err);
    renderTableError('Failed to load admin panel. Please refresh.');
  }
});

// ── DATA LOADING ────────────────────────────────────────────────────────────

async function loadAllMembers() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, phone, role, status, created_at, preferred_community')
    .order('created_at', { ascending: false });

  if (error) {
    renderTableError('Could not fetch members: ' + error.message);
    return;
  }

  allMembers = data || [];
  updateStatCards();
  renderTable(currentFilter);
}

// ── FILTER ──────────────────────────────────────────────────────────────────

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.auth-tab-btn[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTable(filter);
}

// ── RENDER TABLE ─────────────────────────────────────────────────────────────

function renderTable(filter) {
  const members = filter === 'all'
    ? allMembers
    : allMembers.filter(m => m.status === filter);

  const wrap = document.getElementById('members-table-wrap');

  if (members.length === 0) {
    wrap.innerHTML = `<p class="empty-state">No ${filter === 'all' ? '' : filter + ' '}members found.</p>`;
    return;
  }

  wrap.innerHTML = `
    <div style="overflow-x: auto;">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => rowHtml(m)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function rowHtml(m) {
  const joined = m.created_at
    ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '–';

  const statusBadge = `<span class="badge badge-${m.status}">${m.status}</span>`;
  const roleBadge   = `<span class="badge badge-${m.role}">${m.role}</span>`;

  const actions = buildActions(m);

  return `
    <tr id="row-${m.id}">
      <td><strong>${esc(m.full_name || '–')}</strong></td>
      <td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
      <td>${esc(m.phone || '–')}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>${joined}</td>
      <td class="admin-actions">${actions}</td>
    </tr>
  `;
}

function buildActions(m) {
  const btns = [];

  if (m.status === 'pending') {
    btns.push(actionBtn(m.id, 'approve', 'Approve', 'btn-approve'));
    btns.push(actionBtn(m.id, 'deactivate', 'Decline', 'btn-danger'));
  } else if (m.status === 'approved') {
    btns.push(actionBtn(m.id, 'deactivate', 'Deactivate', 'btn-danger'));
    if (m.role !== 'admin') {
      btns.push(actionBtn(m.id, 'make-admin', 'Make Admin', 'btn-secondary'));
    }
    if (m.role === 'admin') {
      btns.push(actionBtn(m.id, 'remove-admin', 'Remove Admin', 'btn-secondary'));
    }
  } else if (m.status === 'inactive') {
    btns.push(actionBtn(m.id, 'approve', 'Reactivate', 'btn-approve'));
  }

  return btns.join('');
}

function actionBtn(id, action, label, cls) {
  return `<button class="admin-btn ${cls}" onclick="doAction('${id}','${action}')">${label}</button>`;
}

// ── ACTIONS ──────────────────────────────────────────────────────────────────

async function doAction(memberId, action) {
  const sb = getSupabase();
  let update = {};

  switch (action) {
    case 'approve':     update = { status: 'approved' };            break;
    case 'deactivate':  update = { status: 'inactive' };            break;
    case 'make-admin':  update = { role: 'admin' };                 break;
    case 'remove-admin':update = { role: 'member' };                break;
    default: return;
  }

  const btn = document.querySelector(`#row-${memberId} button[onclick*="${action}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const { error } = await sb.from('profiles').update(update).eq('id', memberId);

  if (error) {
    toast('Error: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = action; }
    return;
  }

  const labels = { approve: 'approved', deactivate: 'deactivated', 'make-admin': 'promoted to admin', 'remove-admin': 'removed from admin' };
  toast(`Member ${labels[action]}.`, 'success');

  // Update local cache and re-render
  const idx = allMembers.findIndex(m => m.id === memberId);
  if (idx !== -1) {
    allMembers[idx] = { ...allMembers[idx], ...update };
  }
  updateStatCards();
  renderTable(currentFilter);
}

// ── STAT CARDS ────────────────────────────────────────────────────────────────

function updateStatCards() {
  const counts = { pending: 0, approved: 0, inactive: 0 };
  allMembers.forEach(m => { if (counts[m.status] !== undefined) counts[m.status]++; });
  document.getElementById('count-pending').textContent  = counts.pending;
  document.getElementById('count-approved').textContent = counts.approved;
  document.getElementById('count-inactive').textContent = counts.inactive;
  document.getElementById('count-total').textContent    = allMembers.length;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

function toast(msg, type = 'info') {
  const el = document.getElementById('admin-toast');
  el.textContent = msg;
  el.className = `admin-toast show toast-${type}`;
  setTimeout(() => { el.className = 'admin-toast'; }, 4000);
}

// ── SIGN OUT ──────────────────────────────────────────────────────────────────

async function doSignOut() {
  await signOut();
  window.location.href = '/';
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function renderTableError(msg) {
  document.getElementById('members-table-wrap').innerHTML =
    `<p class="notice notice-error">${msg}</p>`;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

window.setFilter  = setFilter;
window.doAction   = doAction;
window.doSignOut  = doSignOut;
