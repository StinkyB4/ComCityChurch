/**
 * COMMISSIONED CITY CHURCH — MEMBER DASHBOARD
 * Sections: home/announcements, profile, community, directory, teams.
 * Each section lazy-loads once on first visit.
 */

let currentProfile = null;
const loaded = { home: false, profile: false, community: false, directory: false, teams: false };
let allDirectoryMembers = [];

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof initSupabase !== 'undefined') await initSupabase();

    const profile = await requireAuth('/members/');
    if (!profile) return;

    if (profile.status !== 'approved') {
      showError('Your account is pending approval. You\'ll receive an email once approved.');
      return;
    }

    currentProfile = profile;
    await bootDashboard(profile);
  } catch (err) {
    console.error('Dashboard init error:', err);
    showError('Failed to load dashboard. Please refresh the page.');
  }
});

async function bootDashboard(profile) {
  // Populate welcome banner
  document.getElementById('member-name').textContent = profile.full_name.split(' ')[0];

  // Load the default (home) section
  await loadHomeSection();

  // Populate info cards
  loadInfoCards(profile);
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────

const SECTIONS = ['announcements-section', 'profile-section', 'community-section', 'directory-section', 'teams-section'];
const SUBNAV   = { home: 'subnav-home', profile: 'subnav-profile', community: 'subnav-community', directory: 'subnav-directory', teams: 'subnav-teams' };

async function navigateTo(section) {
  // Hide all sections
  SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Update sub-nav active state
  Object.values(SUBNAV).forEach(id => document.getElementById(id)?.classList.remove('active'));
  if (SUBNAV[section]) document.getElementById(SUBNAV[section])?.classList.add('active');

  // Show and load selected section
  switch (section) {
    case 'home':
      document.getElementById('announcements-section').style.display = 'block';
      if (!loaded.home) await loadHomeSection();
      break;
    case 'profile':
      document.getElementById('profile-section').style.display = 'block';
      if (!loaded.profile) loadProfileSection(currentProfile);
      break;
    case 'community':
      document.getElementById('community-section').style.display = 'block';
      if (!loaded.community) await loadCommunitySection(currentProfile.preferred_community);
      break;
    case 'directory':
      document.getElementById('directory-section').style.display = 'block';
      if (!loaded.directory) await loadDirectorySection();
      break;
    case 'teams':
      document.getElementById('teams-section').style.display = 'block';
      if (!loaded.teams) await loadTeamsSection();
      break;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── HOME / ANNOUNCEMENTS ──────────────────────────────────────────────────────

async function loadHomeSection() {
  loaded.home = true;
  const container = document.getElementById('announcements-list');

  try {
    const items = await getAnnouncements(20);

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">No announcements yet. Check back soon!</p>';
      return;
    }

    container.innerHTML = items.map(a => `
      <div class="announcement-item">
        <div class="announcement-header">
          <h4>${esc(a.title)}</h4>
          <time datetime="${a.published_at}" class="announcement-date">${fmtDate(a.published_at)}</time>
        </div>
        <p>${esc(a.content)}</p>
        <p class="announcement-author"><strong>From:</strong> ${esc(a.profiles?.full_name || 'Church Leadership')}</p>
      </div>
    `).join('');

    // Update card count
    document.getElementById('announcement-count').textContent = items.length;
  } catch (err) {
    console.error('Error loading announcements:', err);
    container.innerHTML = '<p class="notice notice-error">Failed to load announcements.</p>';
  }
}

// ── INFO CARDS ────────────────────────────────────────────────────────────────

async function loadInfoCards(profile) {
  // Community name
  if (profile.preferred_community) {
    try {
      const sb = getSupabase();
      const { data } = await sb.from('missional_communities')
        .select('name').eq('id', profile.preferred_community).single();
      if (data) document.getElementById('community-name').textContent = data.name;
    } catch (_) {}
  } else {
    document.getElementById('community-name').textContent = 'Not assigned';
  }

  // Teams count
  try {
    const user = await getCurrentUser();
    const sb = getSupabase();
    const { count } = await sb.from('team_members')
      .select('id', { count: 'exact', head: true }).eq('member_id', user.id);
    document.getElementById('teams-count').textContent = count ?? 0;
  } catch (_) {}

  // Announcement count
  try {
    const sb = getSupabase();
    const { count } = await sb.from('admin_messages')
      .select('id', { count: 'exact', head: true });
    document.getElementById('announcement-count').textContent = count ?? 0;
  } catch (_) {}

  // Members count
  try {
    const sb = getSupabase();
    const { count } = await sb.from('profiles')
      .select('id', { count: 'exact', head: true }).eq('status', 'approved');
    document.getElementById('members-count').textContent = count ?? 0;
  } catch (_) {}
}

// ── PROFILE SECTION ───────────────────────────────────────────────────────────

function loadProfileSection(profile) {
  loaded.profile = true;

  document.getElementById('profile-name').textContent      = profile.full_name || '–';
  document.getElementById('profile-email').textContent     = profile.email || '–';
  document.getElementById('profile-phone').textContent     = profile.phone || 'Not provided';
  document.getElementById('profile-community').textContent = '–'; // filled below

  const statusEl = document.getElementById('profile-status');
  statusEl.textContent = cap(profile.status);
  statusEl.className   = `profile-status status-${profile.status}`;

  if (profile.created_at) {
    document.getElementById('profile-joined').textContent = fmtDate(profile.created_at);
  }

  if (profile.bio) {
    document.getElementById('profile-bio').textContent = profile.bio;
    document.getElementById('profile-bio-row').style.display = 'block';
  }

  if (profile.avatar_url) {
    document.getElementById('profile-avatar').src = profile.avatar_url;
  }

  // Fetch community name
  if (profile.preferred_community) {
    const sb = getSupabase();
    sb.from('missional_communities').select('name').eq('id', profile.preferred_community).single()
      .then(({ data }) => {
        if (data) document.getElementById('profile-community').textContent = data.name;
      });
  } else {
    document.getElementById('profile-community').textContent = 'Not assigned';
  }

  // Pre-fill edit form
  document.getElementById('edit-name').value  = profile.full_name || '';
  document.getElementById('edit-phone').value = profile.phone || '';
  document.getElementById('edit-bio').value   = profile.bio || '';
}

function showProfileEdit() {
  document.getElementById('profile-view').style.display = 'none';
  document.getElementById('profile-edit').style.display = 'block';
}

function cancelProfileEdit() {
  document.getElementById('profile-edit').style.display = 'none';
  document.getElementById('profile-view').style.display = 'block';
  clearProfileMessage();
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profile-edit-form');
  if (form) form.addEventListener('submit', handleProfileSave);
});

async function handleProfileSave(e) {
  e.preventDefault();
  clearProfileMessage();

  const fullName = document.getElementById('edit-name').value.trim();
  const phone    = document.getElementById('edit-phone').value.trim();
  const bio      = document.getElementById('edit-bio').value.trim();
  const avatarFile = document.getElementById('edit-avatar').files[0];

  if (!fullName) {
    showProfileMessage('error', 'Full name is required.');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    // Upload avatar first if provided
    if (avatarFile) {
      if (avatarFile.size > 2 * 1024 * 1024) {
        showProfileMessage('error', 'Photo must be under 2 MB.');
        btn.disabled = false; btn.textContent = 'Save Changes';
        return;
      }
      const { error: uploadErr } = await uploadAvatar(avatarFile);
      if (uploadErr) {
        showProfileMessage('error', 'Photo upload failed: ' + uploadErr.message);
        btn.disabled = false; btn.textContent = 'Save Changes';
        return;
      }
      // Refresh profile to get new avatar_url
      currentProfile = await getProfile();
      if (currentProfile?.avatar_url) {
        document.getElementById('profile-avatar').src = currentProfile.avatar_url;
      }
    }

    const updates = { full_name: fullName };
    if (phone) updates.phone = phone;
    if (bio)   updates.bio   = bio;

    const { error } = await updateProfile(updates);
    if (error) throw error;

    // Update local cache and view
    currentProfile = { ...currentProfile, full_name: fullName, phone, bio };
    loaded.profile = false;
    loadProfileSection(currentProfile);

    // Update welcome banner
    document.getElementById('member-name').textContent = fullName.split(' ')[0];

    showProfileMessage('success', 'Profile updated successfully!');
    setTimeout(() => cancelProfileEdit(), 1500);
  } catch (err) {
    console.error('Profile save error:', err);
    showProfileMessage('error', err.message || 'Failed to save. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

function showProfileMessage(type, msg) {
  const el = document.getElementById('profile-edit-message');
  el.textContent = msg;
  el.className = `form-message show ${type}`;
}

function clearProfileMessage() {
  const el = document.getElementById('profile-edit-message');
  if (el) { el.textContent = ''; el.className = 'form-message'; }
}

// ── COMMUNITY SECTION ─────────────────────────────────────────────────────────

async function loadCommunitySection(communityId) {
  loaded.community = true;
  const container = document.getElementById('community-content');

  if (!communityId) {
    container.innerHTML = `
      <div class="notice notice-info">
        <strong>Not yet assigned</strong>
        You haven't been placed in a missional community yet. Speak with a pastor or leader to find the right fit.
      </div>
      <p style="margin-top:1.5rem;">
        <a href="/communities" class="btn btn-primary" style="display:inline-block;">Explore Communities →</a>
      </p>
    `;
    return;
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('missional_communities')
      .select(`
        id, name, description, meeting_time, meeting_location, color,
        profiles:leader_id (id, full_name, email)
      `)
      .eq('id', communityId)
      .single();

    if (error) throw error;

    const mc = data;
    const accentColor = mc.color || 'var(--color-navy)';

    container.innerHTML = `
      <div class="community-detail-card" style="border-left: 5px solid ${esc(accentColor)};">
        <h3 class="community-detail-name">${esc(mc.name)}</h3>
        ${mc.description ? `<p class="community-detail-desc">${esc(mc.description)}</p>` : ''}
        <div class="community-detail-meta">
          ${mc.meeting_time     ? `<div class="community-meta-item"><strong>Meets:</strong> ${esc(mc.meeting_time)}</div>` : ''}
          ${mc.meeting_location ? `<div class="community-meta-item"><strong>Location:</strong> ${esc(mc.meeting_location)}</div>` : ''}
          ${mc.profiles?.full_name ? `<div class="community-meta-item"><strong>Leader:</strong> ${esc(mc.profiles.full_name)}</div>` : ''}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Community load error:', err);
    container.innerHTML = '<p class="notice notice-error">Could not load community details.</p>';
  }
}

// ── MEMBER DIRECTORY ──────────────────────────────────────────────────────────

async function loadDirectorySection() {
  loaded.directory = true;
  const grid = document.getElementById('directory-grid');

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, role, bio, avatar_url, preferred_community')
      .eq('status', 'approved')
      .order('full_name', { ascending: true });

    if (error) throw error;

    allDirectoryMembers = data || [];
    renderDirectory(allDirectoryMembers);
  } catch (err) {
    console.error('Directory load error:', err);
    grid.innerHTML = '<p class="notice notice-error">Could not load directory.</p>';
  }
}

function renderDirectory(members) {
  const grid = document.getElementById('directory-grid');

  if (members.length === 0) {
    grid.innerHTML = '<p class="empty-state">No members found.</p>';
    return;
  }

  grid.innerHTML = members.map(m => {
    const initials = (m.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarHtml = m.avatar_url
      ? `<img src="${esc(m.avatar_url)}" alt="${esc(m.full_name)}" class="member-card-avatar">`
      : `<div class="member-card-avatar member-card-initials">${initials}</div>`;

    const roleLabel = m.role === 'admin' ? 'Leadership' : m.role === 'team' ? 'Team' : 'Member';

    return `
      <div class="member-card">
        ${avatarHtml}
        <p class="member-card-name">${esc(m.full_name)}</p>
        <p class="member-card-role">${roleLabel}</p>
        ${m.bio ? `<p class="member-card-bio">${esc(m.bio)}</p>` : ''}
      </div>
    `;
  }).join('');
}

function filterDirectory(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderDirectory(allDirectoryMembers);
    return;
  }
  renderDirectory(allDirectoryMembers.filter(m =>
    (m.full_name || '').toLowerCase().includes(q)
  ));
}

// ── TEAMS SECTION ─────────────────────────────────────────────────────────────

async function loadTeamsSection() {
  loaded.teams = true;
  const container = document.getElementById('teams-content');

  try {
    const user = await getCurrentUser();
    const sb   = getSupabase();

    const { data, error } = await sb
      .from('team_members')
      .select(`
        id, role, joined_at,
        teams:team_id (id, name, description, color)
      `)
      .eq('member_id', user.id)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="notice notice-info">
          <strong>Not on any teams yet</strong>
          Volunteer teams serve at Sunday gatherings and beyond. Talk to a leader about getting involved.
        </div>
      `;
      document.getElementById('teams-count').textContent = 0;
      return;
    }

    document.getElementById('teams-count').textContent = data.length;

    container.innerHTML = `
      <div class="teams-list">
        ${data.map(tm => {
          const team  = tm.teams;
          const color = team?.color || 'var(--color-navy)';
          const joined = tm.joined_at ? fmtDate(tm.joined_at) : '–';
          return `
            <div class="team-card" style="border-left: 4px solid ${esc(color)};">
              <h3 class="team-card-name">${esc(team?.name || 'Unknown Team')}</h3>
              ${team?.description ? `<p class="team-card-desc">${esc(team.description)}</p>` : ''}
              <p class="team-card-meta">
                <span>Role: <strong>${esc(tm.role || 'Member')}</strong></span>
                <span>Joined: ${joined}</span>
              </p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Teams load error:', err);
    container.innerHTML = '<p class="notice notice-error">Could not load teams.</p>';
  }
}

// ── SIGN OUT ──────────────────────────────────────────────────────────────────

async function signOutUser() {
  await signOut();
  window.location.href = '/';
}

// ── ERROR STATE ───────────────────────────────────────────────────────────────

function showError(message) {
  SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelector('.dashboard-cards').style.display = 'none';

  const errorIndicator = document.getElementById('error-indicator');
  const errorText      = document.getElementById('error-text');
  if (errorIndicator && errorText) {
    errorText.textContent    = message;
    errorIndicator.style.display = 'block';
  }
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

window.navigateTo       = navigateTo;
window.signOutUser      = signOutUser;
window.showProfileEdit  = showProfileEdit;
window.cancelProfileEdit= cancelProfileEdit;
window.filterDirectory  = filterDirectory;
