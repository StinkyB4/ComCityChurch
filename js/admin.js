/**
 * COMMISSIONED CITY CHURCH — ADMIN DASHBOARD
 * 7-tab administration panel. Requires admin role.
 * Tabs: Pending Approvals | All Members | Communities | Teams | Messages | Files | Settings
 */

// ── STATE ─────────────────────────────────────────────────────────────────────

let adminProfile   = null;
let allPending     = [];
let allMembers     = [];
let allCommunities = [];
let allTeams       = [];
let allMessages    = [];
let currentTeamId  = null;
let editingMemberId = null;

const loaded = {};

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof initSupabase !== 'undefined') await initSupabase();
    adminProfile = await requireAdmin('/members/');
    if (!adminProfile) return;
    await switchTab('pending');
  } catch (err) {
    console.error('Admin init error:', err);
    toast('Failed to load admin panel. Please refresh.', 'error');
  }
});

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────

async function switchTab(name) {
  document.querySelectorAll('#admin-sub-nav a[data-tab]').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === name);
  });
  document.querySelectorAll('.admin-tab-panel').forEach(s => {
    s.style.display = s.id === 'tab-' + name ? '' : 'none';
  });
  if (!loaded[name]) {
    await tabLoaders[name]();
    loaded[name] = true;
  }
}

const tabLoaders = {
  pending:     loadPending,
  members:     loadMembers,
  communities: loadCommunities,
  teams:       loadTeams,
  messages:    loadMessages,
  files:       loadFiles,
  settings:    loadSettings,
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: PENDING APPROVALS
// ─────────────────────────────────────────────────────────────────────────────

async function loadPending() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    document.getElementById('pending-content').innerHTML =
      `<p class="notice notice-error">${esc(error.message)}</p>`;
    return;
  }

  allPending = data || [];
  renderPending();
  updatePendingBadge();
}

function renderPending() {
  const el = document.getElementById('pending-content');
  if (!el) return;

  if (!allPending.length) {
    el.innerHTML = `
      <div style="text-align:center; padding:3rem; color:#28a745;">
        <div style="font-size:3rem; margin-bottom:1rem;">&#10003;</div>
        <p style="font-size:1.1rem; margin:0; font-family:var(--font-sans);">No pending approvals.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,.06); overflow:hidden;">
      ${allPending.map(p => {
        const date = p.created_at
          ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '–';
        return `
          <div class="pending-row" id="pending-${p.id}">
            <div class="pending-info">
              <strong>${esc(p.full_name || 'Unknown')}</strong>
              <span>${esc(p.email)}</span>
              <span class="pending-date">Registered ${date}</span>
            </div>
            <div class="pending-actions">
              <button class="admin-btn btn-approve"
                onclick="approveUser('${p.id}','${esc(p.full_name || '')}','${esc(p.email)}')">&#10003; Approve</button>
              <button class="admin-btn btn-danger"
                onclick="declineUser('${p.id}','${esc(p.full_name || '')}')">&#10005; Decline</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

async function approveUser(id, name, email) {
  const sb  = getSupabase();
  const row = document.getElementById('pending-' + id);
  if (row) row.style.opacity = '0.5';

  const { error } = await sb
    .from('profiles')
    .update({ status: 'approved' })
    .eq('id', id);

  if (error) {
    toast('Error approving member: ' + error.message, 'error');
    if (row) row.style.opacity = '';
    return;
  }

  fetch('/api/welcome-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  }).catch(() => {});

  toast(`${name} approved.`, 'success');
  allPending = allPending.filter(p => p.id !== id);
  updatePendingBadge();
  fadeRemove(row, renderPending);
}

async function declineUser(id, name) {
  if (!confirm(`Remove ${name}'s registration? This cannot be undone.`)) return;

  const sb  = getSupabase();
  const row = document.getElementById('pending-' + id);
  if (row) row.style.opacity = '0.5';

  const { error } = await sb
    .from('profiles')
    .update({ status: 'inactive', is_declined: true })
    .eq('id', id);

  if (error) {
    toast('Error: ' + error.message, 'error');
    if (row) row.style.opacity = '';
    return;
  }

  toast(`${name} declined. To fully remove this account, delete the user from your Supabase Auth dashboard.`, 'info');
  allPending = allPending.filter(p => p.id !== id);
  updatePendingBadge();
  fadeRemove(row, renderPending);
}

function updatePendingBadge() {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  badge.textContent = allPending.length > 0 ? String(allPending.length) : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: ALL MEMBERS
// ─────────────────────────────────────────────────────────────────────────────

async function loadMembers() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, phone, bio, role, status, avatar_url, mc_role, preferred_community, created_at, missional_communities:preferred_community(id, name)')
    .eq('status', 'approved')
    .order('full_name', { ascending: true });

  if (error) {
    document.getElementById('members-content').innerHTML =
      `<p class="notice notice-error">${esc(error.message)}</p>`;
    return;
  }

  allMembers = data || [];
  renderMembersTable(allMembers);
}

function renderMembersTable(members) {
  const el = document.getElementById('members-content');
  if (!el) return;

  if (!members.length) {
    el.innerHTML = `<p class="empty-state">No approved members found.</p>`;
    return;
  }

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width:44px;"></th>
            <th>Name</th>
            <th>Email</th>
            <th>Community</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => memberRow(m)).join('')}
        </tbody>
      </table>
    </div>`;
}

function memberRow(m) {
  const mcName  = m.missional_communities?.name || '–';
  const isAdmin = m.role === 'admin';
  return `
    <tr id="mrow-${m.id}">
      <td>${memberAvatarHtml(m, 36)}</td>
      <td><strong>${esc(m.full_name || '–')}</strong></td>
      <td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
      <td>${esc(mcName)}</td>
      <td>
        <label class="admin-toggle-label" title="${isAdmin ? 'Remove admin' : 'Grant admin'}">
          <input type="checkbox" ${isAdmin ? 'checked' : ''}
            onchange="toggleAdmin('${m.id}', this.checked)" style="cursor:pointer;">
        </label>
      </td>
      <td class="admin-actions">
        <button class="admin-btn btn-secondary" onclick="openEditModal('${m.id}')">Edit</button>
        <button class="admin-btn btn-danger"    onclick="deactivateMember('${m.id}','${esc(m.full_name || '')}')">Deactivate</button>
      </td>
    </tr>`;
}

function filterMembers(query) {
  const q        = query.toLowerCase().trim();
  const filtered = q
    ? allMembers.filter(m =>
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email     || '').toLowerCase().includes(q))
    : allMembers;
  renderMembersTable(filtered);
}

async function openEditModal(memberId) {
  editingMemberId = memberId;
  const m = allMembers.find(x => x.id === memberId);
  if (!m) return;

  if (!allCommunities.length) allCommunities = await getCommunities();

  const communityOptions = allCommunities.map(c =>
    `<option value="${c.id}" ${m.preferred_community === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  document.getElementById('admin-modal-body').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <h3 style="margin:0; font-family:var(--font-serif); color:var(--color-navy);">Edit Member</h3>
      <button onclick="closeModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--color-text-muted);">&times;</button>
    </div>
    <form id="edit-member-form" class="auth-form" onsubmit="saveEditModal(event)">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="em-name" value="${esc(m.full_name || '')}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" id="em-phone" value="${esc(m.phone || '')}">
      </div>
      <div class="form-group">
        <label>Bio</label>
        <textarea id="em-bio" rows="3"
          style="padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-family:var(--font-sans);font-size:1rem;resize:vertical;width:100%;box-sizing:border-box;"
        >${esc(m.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Missional Community</label>
        <select id="em-mc"
          style="padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;width:100%;font-family:var(--font-sans);font-size:1rem;">
          <option value="">– Not assigned –</option>
          ${communityOptions}
        </select>
      </div>
      <div class="form-group">
        <label>MC Role</label>
        <select id="em-mc-role"
          style="padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;width:100%;font-family:var(--font-sans);font-size:1rem;">
          <option value="member" ${(m.mc_role || 'member') === 'member' ? 'selected' : ''}>Member</option>
          <option value="leader" ${m.mc_role === 'leader' ? 'selected' : ''}>Leader</option>
        </select>
      </div>
      <div id="edit-modal-msg" class="form-message"></div>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem;">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>`;

  document.getElementById('admin-modal-backdrop').style.display = 'flex';
}

async function saveEditModal(e) {
  e.preventDefault();
  const msgEl = document.getElementById('edit-modal-msg');
  msgEl.className   = 'form-message';
  msgEl.textContent = 'Saving…';

  const updates = {
    full_name:           document.getElementById('em-name').value.trim(),
    phone:               document.getElementById('em-phone').value.trim() || null,
    bio:                 document.getElementById('em-bio').value.trim()   || null,
    preferred_community: document.getElementById('em-mc').value           || null,
    mc_role:             document.getElementById('em-mc-role').value,
  };

  const sb = getSupabase();
  const { error } = await sb.from('profiles').update(updates).eq('id', editingMemberId);

  if (error) {
    msgEl.className   = 'form-message error';
    msgEl.textContent = error.message;
    return;
  }

  const idx = allMembers.findIndex(m => m.id === editingMemberId);
  if (idx !== -1) {
    allMembers[idx] = { ...allMembers[idx], ...updates };
    const mc = allCommunities.find(c => c.id === updates.preferred_community);
    allMembers[idx].missional_communities = mc ? { id: mc.id, name: mc.name } : null;
  }

  toast('Member updated.', 'success');
  closeModal();
  filterMembers(document.getElementById('members-search')?.value || '');
}

async function toggleAdmin(memberId, makeAdmin) {
  const role = makeAdmin ? 'admin' : 'member';
  const sb   = getSupabase();
  const { error } = await sb.from('profiles').update({ role }).eq('id', memberId);
  if (error) {
    toast('Error: ' + error.message, 'error');
    const cb = document.querySelector(`#mrow-${memberId} input[type="checkbox"]`);
    if (cb) cb.checked = !makeAdmin;
    return;
  }
  const idx = allMembers.findIndex(m => m.id === memberId);
  if (idx !== -1) allMembers[idx].role = role;
  toast(`Admin ${makeAdmin ? 'granted' : 'removed'}.`, 'success');
}

async function deactivateMember(memberId, name) {
  if (!confirm(`Deactivate ${name}? They will lose portal access.`)) return;
  const sb = getSupabase();
  const { error } = await sb.from('profiles').update({ status: 'inactive' }).eq('id', memberId);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  allMembers = allMembers.filter(m => m.id !== memberId);
  toast(`${name} deactivated.`, 'success');
  const row = document.getElementById('mrow-' + memberId);
  fadeRemove(row, () => filterMembers(document.getElementById('members-search')?.value || ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: COMMUNITIES
// ─────────────────────────────────────────────────────────────────────────────

async function loadCommunities() {
  const el = document.getElementById('communities-content');
  el.innerHTML = '<p class="loading" style="color:var(--color-text-muted);">Loading…</p>';

  allCommunities = await getCommunities();
  if (!allCommunities.length) {
    el.innerHTML = '<p class="empty-state">No communities found.</p>';
    return;
  }

  const sb = getSupabase();
  const { data: members } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, email, preferred_community, mc_role')
    .eq('status', 'approved')
    .order('full_name');

  const byMC = {};
  (members || []).forEach(m => {
    if (m.preferred_community) {
      if (!byMC[m.preferred_community]) byMC[m.preferred_community] = [];
      byMC[m.preferred_community].push(m);
    }
  });

  el.innerHTML = allCommunities.map(mc => communityBlock(mc, byMC[mc.id] || [])).join('');
}

function communityBlock(mc, members) {
  const leaders = members.filter(m => m.mc_role === 'leader');
  const regular = members.filter(m => m.mc_role !== 'leader');

  const listHtml = (list, label) => {
    if (!list.length) return '';
    return `
      <p style="margin:.75rem 0 .25rem;font-weight:600;color:var(--color-text-muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;">${label}</p>
      ${list.map(m => `
        <div class="pending-row" style="padding:.5rem .75rem;">
          <div class="pending-info" style="flex-direction:row;align-items:center;gap:.75rem;">
            ${memberAvatarHtml(m, 32)}
            <span>${esc(m.full_name)}</span>
          </div>
          <button class="admin-btn btn-danger" style="padding:.25rem .75rem;font-size:.85rem;"
            onclick="removeFromCommunity('${m.id}','${esc(m.full_name)}','${mc.id}')">Remove</button>
        </div>`).join('')}`;
  };

  return `
    <div class="community-admin-block" id="mc-block-${mc.id}">
      <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 .75rem;">${esc(mc.name)}</h3>
      <div id="mc-members-${mc.id}">
        ${listHtml(leaders, 'Leaders')}
        ${listHtml(regular, 'Members')}
        ${!members.length
          ? '<p style="color:var(--color-text-muted);font-style:italic;font-size:.95rem;">No members assigned yet.</p>'
          : ''}
      </div>
      <div class="autocomplete-wrap" style="margin-top:1rem;max-width:420px;">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
          <input type="text" id="mc-search-${mc.id}" placeholder="Add member by name…"
            style="flex:1;min-width:160px;padding:.6rem .875rem;border:1px solid #e0e0e0;border-radius:6px;font-size:.95rem;"
            oninput="mcAutocomplete('${mc.id}',this.value)">
          <select id="mc-role-${mc.id}"
            style="padding:.6rem .875rem;border:1px solid #e0e0e0;border-radius:6px;font-size:.95rem;">
            <option value="member">Member</option>
            <option value="leader">Leader</option>
          </select>
        </div>
        <div id="mc-results-${mc.id}" class="autocomplete-results" style="display:none;"></div>
      </div>
    </div>`;
}

let mcSearchTimer = null;
function mcAutocomplete(mcId, query) {
  clearTimeout(mcSearchTimer);
  const resultsEl = document.getElementById('mc-results-' + mcId);
  if (!query.trim()) { resultsEl.style.display = 'none'; return; }

  mcSearchTimer = setTimeout(async () => {
    const sb = getSupabase();
    const { data } = await sb
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('status', 'approved')
      .ilike('full_name', `%${query}%`)
      .limit(6);

    if (!data?.length) { resultsEl.style.display = 'none'; return; }
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = data.map(p => `
      <div class="autocomplete-item"
        onclick="addToCommunity('${mcId}','${p.id}','${esc(p.full_name)}')">
        ${memberAvatarHtml(p, 28)}<span>${esc(p.full_name)}</span>
      </div>`).join('');
  }, 250);
}

async function addToCommunity(mcId, memberId, memberName) {
  const role = document.getElementById('mc-role-' + mcId)?.value || 'member';
  const sb   = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ preferred_community: mcId, mc_role: role })
    .eq('id', memberId);

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  const inp = document.getElementById('mc-search-' + mcId);
  const res = document.getElementById('mc-results-' + mcId);
  if (inp) inp.value = '';
  if (res) res.style.display = 'none';

  toast(`${memberName} added to community.`, 'success');
  loaded.communities = false;
  await loadCommunities();
  loaded.communities = true;
}

async function removeFromCommunity(memberId, memberName) {
  if (!confirm(`Remove ${memberName} from this community?`)) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ preferred_community: null, mc_role: null })
    .eq('id', memberId);

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast(`${memberName} removed.`, 'success');
  loaded.communities = false;
  await loadCommunities();
  loaded.communities = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: TEAMS
// ─────────────────────────────────────────────────────────────────────────────

async function loadTeams() {
  allTeams = await getTeams();
  renderTeamUI();
}

function renderTeamUI() {
  const el = document.getElementById('teams-content');
  const teamOptions = allTeams.map(t =>
    `<option value="${t.id}">${esc(t.name)}</option>`
  ).join('');

  el.innerHTML = `
    <div style="max-width:620px;">
      <div class="form-group" style="margin-bottom:1.5rem;">
        <label style="font-weight:600;display:block;margin-bottom:.5rem;">Select Team</label>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
          <select id="team-select"
            style="flex:1;min-width:200px;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;"
            onchange="loadTeamDetail(this.value)">
            <option value="">– Choose a team –</option>
            ${teamOptions}
          </select>
          <button class="admin-btn btn-secondary" onclick="showCreateTeam()">+ New Team</button>
        </div>
      </div>

      <div id="create-team-form"
        style="display:none;background:#f9f9f9;border-radius:8px;padding:1rem;margin-bottom:1.5rem;">
        <p style="margin:0 0 .75rem;font-weight:600;">Create New Team</p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;">
          <input type="text" id="new-team-name" placeholder="Team name"
            style="flex:1;min-width:180px;padding:.65rem .875rem;border:1px solid #e0e0e0;border-radius:6px;font-size:.95rem;">
          <button class="admin-btn btn-approve" onclick="createTeam()">Create</button>
          <button class="admin-btn btn-secondary"
            onclick="document.getElementById('create-team-form').style.display='none'">Cancel</button>
        </div>
      </div>

      <div id="team-detail"></div>
    </div>`;
}

function showCreateTeam() {
  document.getElementById('create-team-form').style.display = 'block';
  document.getElementById('new-team-name').focus();
}

async function createTeam() {
  const name = document.getElementById('new-team-name').value.trim();
  if (!name) return;

  const sb = getSupabase();
  const { data, error } = await sb
    .from('teams')
    .insert({ name })
    .select()
    .single();

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  allTeams.push(data);
  toast(`Team "${name}" created.`, 'success');
  loaded.teams = false;
  await loadTeams();
  loaded.teams = true;

  const sel = document.getElementById('team-select');
  if (sel) { sel.value = data.id; await loadTeamDetail(data.id); }
}

async function loadTeamDetail(teamId) {
  currentTeamId = teamId;
  const detailEl = document.getElementById('team-detail');
  if (!detailEl) return;
  if (!teamId) { detailEl.innerHTML = ''; return; }

  detailEl.innerHTML = '<p class="loading" style="color:var(--color-text-muted);">Loading…</p>';

  const team    = allTeams.find(t => t.id === teamId);
  const members = await getTeamMembers(teamId);

  detailEl.innerHTML = `
    <div style="border-top:2px solid #f0f0f0;padding-top:1.5rem;margin-top:.5rem;">
      <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 1rem;">${esc(team?.name || '')}</h3>
      <div id="team-member-list">
        ${!members.length
          ? '<p style="color:var(--color-text-muted);font-style:italic;">No members yet.</p>'
          : members.map(m => teamMemberRow(m)).join('')}
      </div>
      <div class="autocomplete-wrap" style="margin-top:1.5rem;">
        <p style="font-weight:600;margin:0 0 .5rem;">Add Member</p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
          <input type="text" id="team-search" placeholder="Search by name…"
            style="flex:1;min-width:180px;padding:.6rem .875rem;border:1px solid #e0e0e0;border-radius:6px;font-size:.95rem;"
            oninput="teamAutocomplete(this.value)">
          <select id="team-role-select"
            style="padding:.6rem .875rem;border:1px solid #e0e0e0;border-radius:6px;font-size:.95rem;">
            <option value="member">Member</option>
            <option value="leader">Leader</option>
          </select>
        </div>
        <div id="team-search-results" class="autocomplete-results" style="display:none;"></div>
      </div>
    </div>`;
}

function teamMemberRow(m) {
  const profile = m.profiles || m;
  const role    = m.role || 'member';
  const joined  = m.joined_at
    ? new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return `
    <div class="pending-row" id="tmrow-${m.id}" style="padding:.5rem .75rem;">
      <div class="pending-info" style="flex-direction:row;align-items:center;gap:.75rem;">
        ${memberAvatarHtml(profile, 32)}
        <div>
          <strong>${esc(profile.full_name || '–')}</strong>
          <span style="margin-left:.4rem;font-size:.85rem;color:var(--color-text-muted);">
            ${role}${joined ? ' · ' + joined : ''}
          </span>
        </div>
      </div>
      <button class="admin-btn btn-danger" style="padding:.25rem .75rem;font-size:.85rem;"
        onclick="removeFromTeam('${m.id}','${esc(profile.full_name || '')}')">Remove</button>
    </div>`;
}

let teamSearchTimer = null;
function teamAutocomplete(query) {
  clearTimeout(teamSearchTimer);
  const resultsEl = document.getElementById('team-search-results');
  if (!query.trim()) { resultsEl.style.display = 'none'; return; }

  teamSearchTimer = setTimeout(async () => {
    const sb = getSupabase();
    const { data } = await sb
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('status', 'approved')
      .ilike('full_name', `%${query}%`)
      .limit(6);

    if (!data?.length) { resultsEl.style.display = 'none'; return; }
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = data.map(p => `
      <div class="autocomplete-item"
        onclick="addToTeam('${p.id}','${esc(p.full_name)}')">
        ${memberAvatarHtml(p, 28)}<span>${esc(p.full_name)}</span>
      </div>`).join('');
  }, 250);
}

async function addToTeam(memberId, memberName) {
  if (!currentTeamId) return;
  const role = document.getElementById('team-role-select')?.value || 'member';
  const sb   = getSupabase();
  const { error } = await sb
    .from('team_members')
    .insert({ team_id: currentTeamId, member_id: memberId, role });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  const inp = document.getElementById('team-search');
  const res = document.getElementById('team-search-results');
  if (inp) inp.value = '';
  if (res) res.style.display = 'none';

  toast(`${memberName} added to team.`, 'success');
  await loadTeamDetail(currentTeamId);
}

async function removeFromTeam(teamMemberId, memberName) {
  if (!confirm(`Remove ${memberName} from this team?`)) return;
  const sb = getSupabase();
  const { error } = await sb.from('team_members').delete().eq('id', teamMemberId);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast(`${memberName} removed.`, 'success');
  await loadTeamDetail(currentTeamId);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

async function loadMessages() {
  const el = document.getElementById('messages-content');
  el.innerHTML = '<p class="loading" style="color:var(--color-text-muted);">Loading…</p>';

  const sb = getSupabase();
  const { data, error } = await sb
    .from('admin_messages')
    .select('id, title, content, pinned, published_at, author_id')
    .order('pinned',        { ascending: false })
    .order('published_at',  { ascending: false });

  if (error) {
    el.innerHTML = `<p class="notice notice-error">${esc(error.message)}</p>`;
    return;
  }

  allMessages = data || [];
  renderMessagesUI();
}

function renderMessagesUI() {
  const el = document.getElementById('messages-content');

  el.innerHTML = `
    <div class="admin-compose">
      <div class="admin-compose-panel">
        <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 1rem;">Post Message</h3>
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="msg-title" placeholder="Announcement title"
            style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;box-sizing:border-box;">
        </div>
        <div class="form-group">
          <label>Body <small style="font-weight:400;">(HTML supported)</small></label>
          <textarea id="msg-body" rows="6"
            placeholder="Message content…"
            style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;resize:vertical;box-sizing:border-box;font-family:var(--font-sans);"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          <div class="form-group">
            <label>Button Label <small style="font-weight:400;">(optional)</small></label>
            <input type="text" id="msg-link-label" placeholder="e.g. Sign Up, Learn More"
              style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;box-sizing:border-box;">
          </div>
          <div class="form-group">
            <label>Button URL <small style="font-weight:400;">(optional)</small></label>
            <input type="url" id="msg-link-url" placeholder="https://"
              style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;box-sizing:border-box;">
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:.5rem;">
          <input type="checkbox" id="msg-pin" style="width:auto;cursor:pointer;">
          <label for="msg-pin" style="margin:0;cursor:pointer;">&#128204; Pin this message</label>
        </div>
        <button class="btn btn-primary" onclick="postMessage()">Post Message</button>
      </div>

      <div class="admin-compose-list">
        <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 1rem;">Posted Messages</h3>
        <div id="messages-list">
          ${allMessages.length
            ? allMessages.map(m => messageItem(m)).join('')
            : '<p style="color:var(--color-text-muted);font-style:italic;">No messages yet.</p>'}
        </div>
      </div>
    </div>`;
}

function messageItem(m) {
  const date = m.published_at
    ? new Date(m.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '–';
  return `
    <div class="message-item" id="msg-item-${m.id}">
      <div class="message-item-header">
        <strong>${m.pinned ? '&#128204; ' : ''}${esc(m.title)}</strong>
        <span style="font-size:.85rem;color:var(--color-text-muted);">${date}</span>
      </div>
      ${m.link_url ? `<div style="margin:.4rem 0 .2rem;"><a href="${esc(m.link_url)}" target="_blank" rel="noopener"
        style="display:inline-block;padding:.25rem .75rem;border:1px solid var(--color-navy);border-radius:4px;font-size:.8rem;color:var(--color-navy);text-decoration:none;"
        >${esc(m.link_label || m.link_url)}</a></div>` : ''}
      <div class="message-item-actions">
        <button class="admin-btn btn-secondary" style="padding:.2rem .6rem;font-size:.8rem;"
          onclick="togglePin('${m.id}',${m.pinned})">
          ${m.pinned ? 'Unpin' : '&#128204; Pin'}
        </button>
        <button class="admin-btn btn-danger" style="padding:.2rem .6rem;font-size:.8rem;"
          onclick="deleteMessage('${m.id}','${esc(m.title)}')">Delete</button>
      </div>
    </div>`;
}

async function postMessage() {
  const title      = document.getElementById('msg-title')?.value.trim();
  const body       = document.getElementById('msg-body')?.value.trim();
  const pinned     = document.getElementById('msg-pin')?.checked || false;
  const link_url   = document.getElementById('msg-link-url')?.value.trim() || null;
  const link_label = document.getElementById('msg-link-label')?.value.trim() || null;

  if (!title || !body) { toast('Title and body are required.', 'error'); return; }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('admin_messages')
    .insert({
      author_id:    adminProfile.id,
      title,
      content:      body,
      pinned,
      published_at: new Date().toISOString(),
      type:         'announcement',
      ...(link_url   && { link_url }),
      ...(link_label && { link_label }),
    })
    .select()
    .single();

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  document.getElementById('msg-title').value        = '';
  document.getElementById('msg-body').value         = '';
  document.getElementById('msg-pin').checked        = false;
  document.getElementById('msg-link-url').value     = '';
  document.getElementById('msg-link-label').value   = '';

  allMessages = [data, ...allMessages];
  allMessages.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.published_at) - new Date(a.published_at)));
  document.getElementById('messages-list').innerHTML = allMessages.map(m => messageItem(m)).join('');
  toast('Message posted.', 'success');
}

async function togglePin(id, currentPinned) {
  const pinned = !currentPinned;
  const sb = getSupabase();
  const { error } = await sb.from('admin_messages').update({ pinned }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  const msg = allMessages.find(m => m.id === id);
  if (msg) msg.pinned = pinned;
  allMessages.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.published_at) - new Date(a.published_at)));
  document.getElementById('messages-list').innerHTML = allMessages.map(m => messageItem(m)).join('');
  toast(pinned ? 'Message pinned.' : 'Message unpinned.', 'success');
}

async function deleteMessage(id, title) {
  if (!confirm(`Delete message "${title}"?`)) return;
  const sb = getSupabase();
  const { error } = await sb.from('admin_messages').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  allMessages = allMessages.filter(m => m.id !== id);
  const item = document.getElementById('msg-item-' + id);
  fadeRemove(item, () => {
    if (!allMessages.length) {
      const list = document.getElementById('messages-list');
      if (list) list.innerHTML = '<p style="color:var(--color-text-muted);font-style:italic;">No messages yet.</p>';
    }
  });
  toast('Message deleted.', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: FILES (admin view)
// ─────────────────────────────────────────────────────────────────────────────

async function loadFiles() {
  const el = document.getElementById('files-content');
  el.innerHTML = '<p class="loading" style="color:var(--color-text-muted);">Loading…</p>';

  const sb = getSupabase();
  const { data: folders, error: fErr } = await sb
    .from('file_folders')
    .select('*')
    .order('name');

  if (fErr) {
    el.innerHTML = `
      <p class="notice notice-info">
        Files module not set up yet. Create the <code>file_folders</code> and <code>files</code>
        tables in Supabase to enable this tab.
      </p>`;
    return;
  }

  const { data: files } = await sb
    .from('files')
    .select('id, name, description, folder_id, storage_path, uploaded_at')
    .order('uploaded_at', { ascending: false });

  renderFilesAdmin(folders || [], files || []);
}

function renderFilesAdmin(folders, files) {
  const el = document.getElementById('files-content');

  const folderMap = {};
  folders.forEach(f => { folderMap[f.id] = { ...f, files: [] }; });
  files.forEach(f => { if (folderMap[f.folder_id]) folderMap[f.folder_id].files.push(f); });

  el.innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;">
      <button class="admin-btn btn-secondary" onclick="showCreateFolderModal()">+ Create Folder</button>
      <label class="admin-btn btn-approve" style="cursor:pointer;display:inline-flex;align-items:center;">
        &#8593; Upload File
        <input type="file" id="admin-file-upload" style="display:none;" onchange="adminUploadFile(this)">
      </label>
    </div>
    ${!folders.length
      ? '<p class="empty-state">No folders yet. Create one above.</p>'
      : Object.values(folderMap).map(folder => `
          <div class="community-admin-block" style="margin-bottom:1.5rem;">
            <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 .75rem;">${esc(folder.name)}</h3>
            ${!folder.files.length
              ? '<p style="color:var(--color-text-muted);font-style:italic;font-size:.95rem;">No files in this folder.</p>'
              : folder.files.map(f => `
                  <div class="pending-row" id="file-row-${f.id}" style="padding:.5rem .75rem;">
                    <div class="pending-info">
                      <strong>${esc(f.name)}</strong>
                      ${f.description ? `<span>${esc(f.description)}</span>` : ''}
                    </div>
                    <button class="admin-btn btn-danger" style="padding:.25rem .75rem;font-size:.85rem;"
                      onclick="deleteFile('${f.id}','${esc(f.name)}','${esc(f.storage_path || '')}')">Delete</button>
                  </div>`).join('')}
          </div>`).join('')}`;
}

function showCreateFolderModal() {
  document.getElementById('admin-modal-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
      <h3 style="margin:0;font-family:var(--font-serif);color:var(--color-navy);">Create Folder</h3>
      <button onclick="closeModal()"
        style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--color-text-muted);">&times;</button>
    </div>
    <div class="form-group">
      <label>Folder Name</label>
      <input type="text" id="folder-name"
        style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;box-sizing:border-box;">
    </div>
    <div class="form-group">
      <label>Description <small>(optional)</small></label>
      <input type="text" id="folder-desc"
        style="width:100%;padding:.75rem;border:1px solid #e0e0e0;border-radius:6px;font-size:1rem;box-sizing:border-box;">
    </div>
    <div id="folder-msg" class="form-message"></div>
    <div style="display:flex;gap:1rem;margin-top:1rem;">
      <button class="btn btn-primary" onclick="createFolder()">Create</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    </div>`;
  document.getElementById('admin-modal-backdrop').style.display = 'flex';
}

async function createFolder() {
  const name = document.getElementById('folder-name')?.value.trim();
  const desc = document.getElementById('folder-desc')?.value.trim() || null;
  if (!name) return;

  const sb = getSupabase();
  const { error } = await sb.from('file_folders').insert({ name, description: desc });
  if (error) {
    const msgEl = document.getElementById('folder-msg');
    if (msgEl) { msgEl.className = 'form-message error'; msgEl.textContent = error.message; }
    return;
  }

  toast(`Folder "${name}" created.`, 'success');
  closeModal();
  loaded.files = false;
  await loadFiles();
  loaded.files = true;
}

async function adminUploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  toast('Uploading…', 'info');

  const sb = getSupabase();
  const { data: folders } = await sb
    .from('file_folders')
    .select('id, name')
    .order('name')
    .limit(1);

  const folderId = folders?.[0]?.id;
  if (!folderId) { toast('Create a folder first.', 'error'); return; }

  const storagePath = `uploads/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await sb.storage.from('church-files').upload(storagePath, file);
  if (uploadErr) { toast('Upload error: ' + uploadErr.message, 'error'); return; }

  const { data: urlData } = sb.storage.from('church-files').getPublicUrl(storagePath);

  const { data: fileRow, error: dbErr } = await sb
    .from('files')
    .insert({
      name:        file.name,
      folder_id:   folderId,
      storage_path: storagePath,
      file_url:    urlData.publicUrl,
      uploaded_by: adminProfile.id,
    })
    .select()
    .single();

  if (dbErr) { toast('DB error: ' + dbErr.message, 'error'); return; }

  // Notify all approved members
  const { data: memberIds } = await sb
    .from('profiles')
    .select('id')
    .eq('status', 'approved');

  if (memberIds?.length && fileRow?.id) {
    await sb.from('file_notifications')
      .insert(memberIds.map(m => ({ file_id: fileRow.id, member_id: m.id, seen: false })));
  }

  toast(`"${file.name}" uploaded.`, 'success');
  input.value = '';
  loaded.files = false;
  await loadFiles();
  loaded.files = true;
}

async function deleteFile(fileId, fileName, storagePath) {
  if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
  const sb = getSupabase();

  if (storagePath) await sb.storage.from('church-files').remove([storagePath]);
  await sb.from('file_notifications').delete().eq('file_id', fileId);

  const { error } = await sb.from('files').delete().eq('id', fileId);
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  const row = document.getElementById('file-row-' + fileId);
  fadeRemove(row);
  toast(`"${fileName}" deleted.`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7: SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

async function loadSettings() {
  document.getElementById('settings-content').innerHTML = `
    <div style="max-width:520px;">
      <div class="community-admin-block">
        <h3 style="font-family:var(--font-serif);color:var(--color-navy);margin:0 0 .5rem;">Export Member List</h3>
        <p style="color:var(--color-text-muted);font-size:.95rem;margin:0 0 1.25rem;">
          Download a CSV of all approved members including community and team assignments.
        </p>
        <button class="btn btn-primary" id="export-csv-btn" onclick="runExportCSV()">
          Export Members (CSV)
        </button>
      </div>
    </div>`;
}

async function runExportCSV() {
  const btn = document.getElementById('export-csv-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Fetching data…'; }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select(`
      full_name, email, phone, address, mc_role, created_at,
      missional_communities:preferred_community(name),
      team_members(teams(name))
    `)
    .eq('status', 'approved')
    .order('full_name');

  if (btn) { btn.disabled = false; btn.textContent = 'Export Members (CSV)'; }
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  exportMembersCSV(data || []);
}

function exportMembersCSV(profiles) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone',
                   'Address',   'MC',         'MC Role', 'Teams', 'Joined'];

  const rows = profiles.map(p => {
    const parts = (p.full_name || '').trim().split(/\s+/);
    return [
      parts[0] || '',
      parts.slice(1).join(' '),
      p.email   || '',
      p.phone   || '',
      p.address || '',
      p.missional_communities?.name || '',
      p.mc_role || '',
      (p.team_members || []).map(t => t.teams?.name).filter(Boolean).join('; '),
      p.created_at ? new Date(p.created_at).toLocaleDateString('en-CA') : '',
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── MODAL ─────────────────────────────────────────────────────────────────────

function closeModal(e) {
  if (e && e.target !== document.getElementById('admin-modal-backdrop')) return;
  document.getElementById('admin-modal-backdrop').style.display = 'none';
  document.getElementById('admin-modal-body').innerHTML = '';
  editingMemberId = null;
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function fadeRemove(el, callback) {
  if (!el) { if (callback) callback(); return; }
  el.style.transition = 'opacity .3s';
  el.style.opacity    = '0';
  setTimeout(() => { el.remove(); if (callback) callback(); }, 320);
}

function memberAvatarHtml(profile, size) {
  size = size || 36;
  const s = size + 'px';
  if (profile && profile.avatar_url) {
    return `<img src="${esc(profile.avatar_url)}" alt=""
      style="width:${s};height:${s};border-radius:50%;object-fit:cover;flex-shrink:0;">`;
  }
  const name     = (profile && profile.full_name) ? profile.full_name : '?';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<div style="width:${s};height:${s};border-radius:50%;background:var(--color-navy);
    color:white;display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(size * 0.36)}px;font-weight:700;flex-shrink:0;font-family:var(--font-sans);">
    ${initials}</div>`;
}

function toast(msg, type) {
  type = type || 'info';
  const el = document.getElementById('admin-toast');
  el.textContent = msg;
  el.className   = `admin-toast show toast-${type}`;
  setTimeout(() => { el.className = 'admin-toast'; }, 5000);
}

async function doSignOut() {
  await signOut();
  window.location.href = '/';
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
  );
}

// ── WINDOW EXPORTS ────────────────────────────────────────────────────────────

window.switchTab             = switchTab;
window.approveUser           = approveUser;
window.declineUser           = declineUser;
window.filterMembers         = filterMembers;
window.openEditModal         = openEditModal;
window.saveEditModal         = saveEditModal;
window.closeModal            = closeModal;
window.toggleAdmin           = toggleAdmin;
window.deactivateMember      = deactivateMember;
window.mcAutocomplete        = mcAutocomplete;
window.addToCommunity        = addToCommunity;
window.removeFromCommunity   = removeFromCommunity;
window.showCreateTeam        = showCreateTeam;
window.createTeam            = createTeam;
window.loadTeamDetail        = loadTeamDetail;
window.teamAutocomplete      = teamAutocomplete;
window.addToTeam             = addToTeam;
window.removeFromTeam        = removeFromTeam;
window.postMessage           = postMessage;
window.togglePin             = togglePin;
window.deleteMessage         = deleteMessage;
window.showCreateFolderModal = showCreateFolderModal;
window.createFolder          = createFolder;
window.adminUploadFile       = adminUploadFile;
window.deleteFile            = deleteFile;
window.runExportCSV          = runExportCSV;
window.doSignOut             = doSignOut;
