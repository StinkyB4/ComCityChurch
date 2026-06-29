/**
 * DASHBOARD MODULE — Part E: Admin tab + Email tab
 * Requires dashboard.js to be loaded first.
 */
(function () {
  'use strict';

  var MAX_WAIT = 60, waited = 0;
  function tryRegister() {
    if (window.mpDashboard) { register(); }
    else if (waited < MAX_WAIT) { waited++; setTimeout(tryRegister, 100); }
  }
  function register() {
    window.mpDashboard.render_admin = renderAdminTab;
    window.mpDashboard.render_email = renderEmailTab;
  }
  tryRegister();

  /* shared RTE toolbar HTML */
  var _RTE_SIZES     = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  var _RTE_HTML_SIZE = [1, 1,  2,  2,  3,  3,  4,  4,  5,  5,  6,  6,  7,  7,  7,  7];
  var _RTE_FG = ['#000000','#333333','#555555','#777777','#999999','#ffffff',
    '#e53e3e','#dd6b20','#d69e2e','#38a169','#2b6cb0','#6b46c1',
    '#feb2b2','#fbd38d','#fefcbf','#c6f6d5','#bee3f8','#e9d8fd'];
  var _RTE_BG = ['transparent','#fef08a','#bbf7d0','#bfdbfe','#fecaca','#fed7aa',
    '#e9d8fd','#fce7f3','#ccfbf1','#f0fdf4','#eff6ff','#fdf4ff',
    '#000000','#333333','#ffffff','#f9f6f4','#ede8e4','#d4c5bb'];

  function _rteSwatches(colors, bId, hId, type, indId, pickId) {
    return colors.map(function (c) {
      var isNone = c === 'transparent';
      var style = isNone
        ? 'background:linear-gradient(135deg,#fff 45%,#e53e3e 45%,#e53e3e 55%,#fff 55%);border:1px solid #ddd;'
        : 'background:' + c + ';';
      return '<button type="button" class="mp-rte-swatch" style="' + style + '"'
        + ' onclick="rteApplyColor(\'' + bId + '\',\'' + hId + '\',\'' + type + '\',\'' + c + '\',\'' + indId + '\',\'' + pickId + '\')"'
        + ' title="' + (isNone ? 'None' : c) + '"></button>';
    }).join('');
  }

  function rteToolbar(bodyId, hiddenId, prefix) {
    prefix = prefix || 'rte';
    var b = bodyId, h = hiddenId;
    var fgPick = prefix + '-fgpick', fgInd = prefix + '-fgind';
    var bgPick = prefix + '-bgpick', bgInd = prefix + '-bgind';
    var sizeDisp = prefix + '-size';
    var alnMenu  = prefix + '-alnmenu';
    var lsMenu   = prefix + '-lsmenu';

    /* inline SVG icons */
    var iLink   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    var iImg    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    var iPencil = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    var iAlnL   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>';
    var iAlnC   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
    var iAlnR   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>';
    var iAlnJ   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    var iLS     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="20" y2="6"/><line x1="3" y1="12" x2="20" y2="12"/><line x1="3" y1="18" x2="20" y2="18"/><polyline points="17 3 20 6 17 9"/><polyline points="17 15 20 18 17 21"/></svg>';
    var iBullet = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>';
    var iOrdered= '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><text x="1.5" y="8.5" font-size="7.5" fill="currentColor" stroke="none" font-family="Arial,sans-serif">1.</text><text x="1.5" y="14.5" font-size="7.5" fill="currentColor" stroke="none" font-family="Arial,sans-serif">2.</text><text x="1.5" y="20.5" font-size="7.5" fill="currentColor" stroke="none" font-family="Arial,sans-serif">3.</text></svg>';
    var iOutdent= '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="9" y2="6"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="21" y1="18" x2="9" y2="18"/><polyline points="7 9 3 12 7 15"/></svg>';
    var iIndent = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="11 9 15 12 11 15"/></svg>';
    var iChevD  = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';

    var T = '<div class="mp-rte-toolbar">';

    /* font family */
    T += '<select class="mp-rte-select mp-rte-select--wide" title="Font family" onchange="rteSetFont(\'' + b + '\',\'' + h + '\',this.value)">'
       + '<option value="Arial" selected>Arial</option>'
       + '<option value="Georgia">Georgia</option>'
       + '<option value="Times New Roman">Times New Roman</option>'
       + '<option value="Courier New">Courier New</option>'
       + '<option value="Verdana">Verdana</option>'
       + '<option value="Helvetica">Helvetica</option>'
       + '</select>';
    T += '<span class="mp-rte-sep"></span>';

    /* font size stepper */
    T += '<button type="button" class="mp-rte-btn mp-rte-btn--size" onclick="rteSizeStep(\'' + b + '\',\'' + h + '\',\'' + sizeDisp + '\',-1)" title="Decrease font size">−</button>';
    T += '<span class="mp-rte-size-display" id="' + sizeDisp + '">11</span>';
    T += '<button type="button" class="mp-rte-btn mp-rte-btn--size" onclick="rteSizeStep(\'' + b + '\',\'' + h + '\',\'' + sizeDisp + '\',1)" title="Increase font size">+</button>';
    T += '<span class="mp-rte-sep"></span>';

    /* B I U */
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'bold\')" title="Bold"><strong>B</strong></button>';
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'italic\')" title="Italic"><em>I</em></button>';
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'underline\')" title="Underline"><u>U</u></button>';

    /* text color */
    T += '<div class="mp-rte-color-btn-wrap">'
       + '<button type="button" class="mp-rte-btn mp-rte-btn--color" onclick="rteTogglePicker(\'' + fgPick + '\')" title="Text color">'
       + '<span style="font-weight:700;line-height:1;font-size:0.9em;">A</span>'
       + '<span class="mp-rte-color-indicator" id="' + fgInd + '" style="background:#000000"></span>'
       + '</button>'
       + '<div class="mp-rte-picker" id="' + fgPick + '" style="display:none;">'
       + '<div class="mp-rte-picker-label">Text Color</div>'
       + '<div class="mp-rte-swatch-grid">' + _rteSwatches(_RTE_FG, b, h, 'fore', fgInd, fgPick) + '</div>'
       + '<input type="color" class="mp-rte-color-full" value="#000000" oninput="rteApplyColor(\'' + b + '\',\'' + h + '\',\'fore\',this.value,\'' + fgInd + '\',\'\')">'
       + '</div></div>';

    /* highlight color */
    T += '<div class="mp-rte-color-btn-wrap">'
       + '<button type="button" class="mp-rte-btn mp-rte-btn--color" onclick="rteTogglePicker(\'' + bgPick + '\')" title="Highlight color">'
       + iPencil
       + '<span class="mp-rte-color-indicator" id="' + bgInd + '" style="background:#fef08a"></span>'
       + '</button>'
       + '<div class="mp-rte-picker" id="' + bgPick + '" style="display:none;">'
       + '<div class="mp-rte-picker-label">Highlight Color</div>'
       + '<div class="mp-rte-swatch-grid">' + _rteSwatches(_RTE_BG, b, h, 'back', bgInd, bgPick) + '</div>'
       + '<input type="color" class="mp-rte-color-full" value="#fef08a" oninput="rteApplyColor(\'' + b + '\',\'' + h + '\',\'back\',this.value,\'' + bgInd + '\',\'\')">'
       + '</div></div>';
    T += '<span class="mp-rte-sep"></span>';

    /* link, image */
    T += '<button type="button" class="mp-rte-btn" onclick="rteInsertLink(\'' + b + '\',\'' + h + '\')" title="Insert link">' + iLink + '</button>';
    T += '<button type="button" class="mp-rte-btn" onclick="rteInsertImage(\'' + b + '\',\'' + h + '\')" title="Insert image">' + iImg + '</button>';
    T += '<span class="mp-rte-sep"></span>';

    /* alignment dropdown */
    T += '<div class="mp-rte-dropdown-wrap">'
       + '<button type="button" class="mp-rte-btn mp-rte-btn--dd" onclick="rteTogglePicker(\'' + alnMenu + '\')" title="Text alignment">' + iAlnL + iChevD + '</button>'
       + '<div class="mp-rte-picker mp-rte-dropdown-menu" id="' + alnMenu + '" style="display:none;">'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'justifyLeft\');rteTogglePicker(\'' + alnMenu + '\')">' + iAlnL + ' Left</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'justifyCenter\');rteTogglePicker(\'' + alnMenu + '\')">' + iAlnC + ' Center</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'justifyRight\');rteTogglePicker(\'' + alnMenu + '\')">' + iAlnR + ' Right</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'justifyFull\');rteTogglePicker(\'' + alnMenu + '\')">' + iAlnJ + ' Justify</button>'
       + '</div></div>';

    /* line spacing dropdown */
    T += '<div class="mp-rte-dropdown-wrap">'
       + '<button type="button" class="mp-rte-btn mp-rte-btn--dd" onclick="rteTogglePicker(\'' + lsMenu + '\')" title="Line spacing">' + iLS + iChevD + '</button>'
       + '<div class="mp-rte-picker mp-rte-dropdown-menu" id="' + lsMenu + '" style="display:none;">'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteLineSpacing(\'' + b + '\',\'' + h + '\',\'1\');rteTogglePicker(\'' + lsMenu + '\')">Single (1.0)</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteLineSpacing(\'' + b + '\',\'' + h + '\',\'1.15\');rteTogglePicker(\'' + lsMenu + '\')">1.15</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteLineSpacing(\'' + b + '\',\'' + h + '\',\'1.5\');rteTogglePicker(\'' + lsMenu + '\')">1.5</button>'
       + '<button type="button" class="mp-rte-dropdown-item" onclick="rteLineSpacing(\'' + b + '\',\'' + h + '\',\'2\');rteTogglePicker(\'' + lsMenu + '\')">Double (2.0)</button>'
       + '</div></div>';
    T += '<span class="mp-rte-sep"></span>';

    /* lists */
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'insertUnorderedList\')" title="Bullet list">' + iBullet + '</button>';
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'insertOrderedList\')" title="Numbered list">' + iOrdered + '</button>';
    T += '<span class="mp-rte-sep"></span>';

    /* indent */
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'outdent\')" title="Decrease indent">' + iOutdent + '</button>';
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'indent\')" title="Increase indent">' + iIndent + '</button>';
    T += '<span class="mp-rte-sep"></span>';

    /* clear formatting */
    T += '<button type="button" class="mp-rte-btn" onclick="rteExecCmd(\'' + b + '\',\'' + h + '\',\'removeFormat\')" title="Clear formatting">✕</button>';

    T += '</div>';
    return T;
  }

  /* ══════════════════════════════════════════════════════════════
     TAB: ADMIN
     ══════════════════════════════════════════════════════════════ */
  async function renderAdminTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    if (!_isAdmin) { D.setContent('<p class="mp-empty">Access denied.</p>'); return; }

    var qs = new URLSearchParams(window.location.search);
    var editUid = qs.get('admin_edit') || '';

    /* member edit view */
    if (editUid) { await renderAdminMemberEdit(editUid); return; }

    /* ── list view ── */
    var [allRes, teamsRes, mcsRes] = await Promise.all([
      _sb.from('profiles').select('*').order('created_at', { ascending: false }),
      _sb.from('teams').select('id,name,member_id:team_members(member_id)'),
      _sb.from('missional_communities').select('id,name')
    ]);
    var allMembers = allRes.data || [];
    var teams      = teamsRes.data || [];
    var mcs        = mcsRes.data || [];

    /* quick stats */
    var approved = allMembers.filter(function (m) { return m.status === 'approved'; });
    var pending  = allMembers.filter(function (m) { return m.status === 'pending'; });
    var coupled  = Math.floor(approved.filter(function (m) { return m.spouse_id; }).length / 2);

    var html = '<h2 class="mp-tab-title">Admin</h2>';

    /* flash messages */
    if (qs.get('email_sent') === '1') html += D.alertHtml('Email sent successfully.', 'success');
    if (qs.get('email_sent') === '0') html += D.alertHtml('Email send failed — check SMTP settings.', 'error');
    if (qs.get('email_error'))        html += D.alertHtml('Please fill in all required fields before sending.', 'error');

    /* stats */
    html += '<div class="mp-admin-stats">';
    html += '<div class="mp-stat-card"><div class="mp-stat-number">' + approved.length + '</div><div class="mp-stat-label">Approved Members</div></div>';
    html += '<div class="mp-stat-card"><div class="mp-stat-number">' + pending.length  + '</div><div class="mp-stat-label">Pending Approval</div></div>';
    html += '<div class="mp-stat-card"><div class="mp-stat-number">' + coupled         + '</div><div class="mp-stat-label">Linked Couples</div></div>';
    html += '</div>';

    /* compose panel (hidden by default) */
    html += '<div class="mp-compose-panel" id="admin-compose-panel" style="display:none;">';
    html += '<div class="mp-compose-header"><span class="mp-compose-title">✉ New Email</span><button type="button" class="mp-compose-close" onclick="document.getElementById(\'admin-compose-panel\').style.display=\'none\';">×</button></div>';
    html += '<form id="admin-email-form"><div class="mp-form-group" style="margin-bottom:12px;"><label style="font-size:0.82em;font-weight:700;text-transform:uppercase;color:#999;">To</label><input type="text" name="to_emails" id="admin-email-to" class="mp-compose-to" placeholder="email@example.com, …" required><span class="mp-hint">Comma-separated. You can edit before sending.</span></div>';
    html += '<div class="mp-form-group" style="margin-bottom:12px;"><label style="font-size:0.82em;font-weight:700;text-transform:uppercase;color:#999;">Subject</label><input type="text" name="subject" required placeholder="Email subject"></div>';
    html += '<div class="mp-form-group"><label style="font-size:0.82em;font-weight:700;text-transform:uppercase;color:#999;">Message</label>';
    html += rteToolbar('admin-email-body', 'admin-email-hidden', 'adminRte');
    html += '<div class="mp-rte-body" id="admin-email-body" contenteditable="true" data-placeholder="Write your message here…"></div>';
    html += '<textarea name="body" id="admin-email-hidden" style="display:none;"></textarea></div>';
    html += '<div style="display:flex;gap:10px;margin-top:14px;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;" onclick="adminRteSync()">Send Email</button><button type="button" class="mp-btn mp-btn--secondary" onclick="document.getElementById(\'admin-compose-panel\').style.display=\'none\';">Cancel</button></div></form></div>';

    /* selection toolbar */
    html += '<div class="mp-selection-toolbar" id="admin-sel-bar" style="display:none;">';
    html += '<span class="mp-selection-count" id="admin-sel-count">0 selected</span>';
    html += '<div class="mp-selection-actions">';
    html += '<button type="button" class="mp-btn mp-btn--primary mp-btn--small" onclick="mpAdminOpenCompose()">✉ Email Selected</button>';
    html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" id="admin-copy-btn" onclick="mpAdminCopyEmails()">📋 Copy Emails</button>';
    html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpAdminClearSel()">✕ Clear</button>';
    html += '</div></div>';

    /* filter bar */
    html += '<h3 class="mp-section-title">All Members</h3>';
    html += '<div class="mp-admin-filter-bar">';
    html += '<input type="text" id="admin-search" placeholder="Search name, email, phone, address…" class="mp-search-input mp-admin-search-input" oninput="mpAdminFilter()">';
    html += '<select id="admin-mc-filter" class="mp-admin-filter-select" onchange="mpAdminFilter()"><option value="">All MCs</option>';
    /* build MC filter options — we'll need to fetch mc_members */
    html += '</select>';
    html += '<select id="admin-team-filter" class="mp-admin-filter-select" onchange="mpAdminFilter()"><option value="">All Teams</option>';
    teams.forEach(function (t) {
      var mids = (t.member_id || []).map(function (x) { return typeof x === 'object' ? x.member_id : x; });
      html += '<option value="team-' + D.esc(t.id) + '" data-members="' + D.esc(mids.join(',')) + '">' + D.esc(t.name) + '</option>';
    });
    html += '</select>';
    html += '<button type="button" class="mp-btn mp-btn--ghost mp-btn--small" onclick="mpAdminClearFilters()" style="white-space:nowrap;">Clear filters</button>';
    html += '</div>';

    /* select all */
    html += '<div class="mp-admin-cards-header"><label class="mp-admin-select-all-label"><input type="checkbox" id="admin-sel-all" onchange="mpAdminSelectAll(this)"> <span>Select all visible</span></label></div>';

    /* member cards */
    html += '<div class="mp-admin-cards" id="admin-cards">';
    allMembers.forEach(function (m) {
      var mname = ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || m.email;
      var approved2 = m.status === 'approved';
      var hidden   = m.show_in_directory === false;
      var initials = D.getInitials(m);
      var gender_l = m.gender === 'male' ? 'Male' : m.gender === 'female' ? 'Female' : '';
      var search   = [mname, m.email, gender_l, m.phone1, m.phone2, m.addr_street, m.addr_city, m.birthday, approved2 ? 'approved' : 'pending'].filter(Boolean).join(' ').toLowerCase();
      html += '<div class="mp-admin-card' + (hidden ? ' mp-admin-card--hidden' : '') + '" data-uid="' + D.esc(m.id) + '" data-email="' + D.esc(m.email) + '" data-search="' + D.esc(search) + '">';
      html += '<label class="mp-admin-card-cb"><input type="checkbox" class="admin-row-cb" value="' + D.esc(m.email) + '" data-name="' + D.esc(mname) + '" onchange="mpAdminRowChecked()"></label>';
      html += '<div class="mp-admin-card-name-bar">' + D.esc(mname);
      if (m.role === 'admin') html += ' <span class="mp-status-badge mp-status-badge--admin">Admin</span>';
      if (!approved2) html += ' <span class="mp-status-badge mp-status-badge--pending">Pending</span>';
      if (hidden)     html += ' <span class="mp-status-badge mp-status-badge--hidden">Hidden</span>';
      html += '</div>';
      html += '<div class="mp-admin-card-top">' + D.renderAvatar(initials, m.avatar_url || '', '') + '</div>';
      html += '<div class="mp-admin-card-body">';
      html += '<div class="mp-admin-card-row"><span class="mp-admin-card-label">Email</span><span class="mp-admin-card-value">' + D.esc(m.email) + '</span></div>';
      if (m.phone1) html += '<div class="mp-admin-card-row"><span class="mp-admin-card-label">' + D.esc(m.phone1_type || 'Cell') + '</span><span class="mp-admin-card-value">' + D.esc(m.phone1) + '</span></div>';
      if (gender_l)  html += '<div class="mp-admin-card-row"><span class="mp-admin-card-label">Gender</span><span class="mp-admin-card-value">' + D.esc(gender_l) + '</span></div>';
      if (m.birthday) html += '<div class="mp-admin-card-row"><span class="mp-admin-card-label">Birthday</span><span class="mp-admin-card-value">' + D.esc(D.fmtDate(m.birthday)) + '</span></div>';
      html += '<div class="mp-admin-card-row"><span class="mp-admin-card-label">Joined</span><span class="mp-admin-card-value">' + D.esc(new Date(m.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })) + '</span></div>';
      html += '</div>';
      html += '<div class="mp-admin-card-footer">';
      html += '<a href="#" class="mp-btn mp-btn--primary mp-btn--small" onclick="mpAdminEdit(\'' + D.esc(m.id) + '\');return false;">Edit</a>';
      html += '<button class="mp-btn mp-btn--small mp-btn--outline" onclick="mpAdminToggleDir(\'' + D.esc(m.id) + '\',\'' + (hidden ? 'show' : 'hide') + '\')" title="' + (hidden ? 'Show in directory' : 'Hide from directory') + '">' + (hidden ? '👁 Show' : '👁 Hide') + '</button>';
      if (m.spouse_id) html += '<button class="mp-btn mp-btn--danger mp-btn--small" onclick="mpAdminUnlinkSpouse(\'' + D.esc(m.id) + '\',\'' + D.esc(mname) + '\')">Unlink</button>';
      if (!approved2) html += '<button class="mp-btn mp-btn--approve mp-btn--small" onclick="mpApproveUser(\'' + D.esc(m.id) + '\')">Approve</button>';
      if (m.role === 'admin') html += '<button class="mp-btn mp-btn--danger mp-btn--small" disabled title="Admin accounts can\'t be deleted. Change the role to Member first.">Delete</button>';
      else html += '<button class="mp-btn mp-btn--danger mp-btn--small" onclick="mpAdminDeleteUser(\'' + D.esc(m.id) + '\',\'' + D.esc(mname) + '\')">Delete</button>';
      html += '</div></div>';
    });
    html += '</div>';

    D.setContent(html);

    /* wire compose form */
    var cform = document.getElementById('admin-email-form');
    if (cform) {
      var rteBody = document.getElementById('admin-email-body'), rteHid = document.getElementById('admin-email-hidden');
      if (rteBody && rteHid) rteBody.addEventListener('input', function () { rteHid.value = rteBody.innerHTML; });
      cform.addEventListener('submit', async function (e) {
        e.preventDefault();
        adminRteSync();
        var fd = new FormData(cform);
        var toRaw = fd.get('to_emails') || '', subject = fd.get('subject') || '', body = fd.get('body') || '';
        if (!subject || !body || !toRaw) { alert('Please fill in all fields.'); return; }
        var recipients = toRaw.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); });
        if (!recipients.length) { alert('No valid email addresses.'); return; }
        await D.callEdge('send-email', { action: 'special_email', subject, body, recipients });
        /* also log to sent_email_log */
        await _sb.from('sent_email_log').insert({ subject, body, recipients, sent_by: (_profile.first_name || _profile.full_name || 'Admin'), success: true, type: 'special' });
        document.getElementById('admin-compose-panel').style.display = 'none';
        alert('Email sent to ' + recipients.length + ' recipient(s).');
      });
    }
  }

  /* admin RTE helpers */
  window.adminRteCmd  = function (cmd) { var b = document.getElementById('admin-email-body'); if (b) { b.focus(); document.execCommand(cmd, false, null); } adminRteSync(); };
  window.adminRteLink = function () {
    var b = document.getElementById('admin-email-body'); if (!b) return;
    var sel = window.getSelection(), saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var url = prompt('URL:', 'https://'); if (!url || url === 'https://') return;
    b.focus(); if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
    document.execCommand('createLink', false, url);
    adminRteSync();
  };
  window.adminRteSync = function () {
    var b = document.getElementById('admin-email-body'), h = document.getElementById('admin-email-hidden');
    if (b && h) h.value = b.innerHTML;
  };

  /* admin member list interactions */
  window.mpAdminFilter = function () {
    var q    = (document.getElementById('admin-search').value || '').toLowerCase().trim();
    var tmSel = document.getElementById('admin-team-filter');
    var tmOpt = tmSel ? tmSel.options[tmSel.selectedIndex] : null;
    var tmUIDs = tmOpt && tmOpt.value ? (tmOpt.dataset.members || '').split(',').filter(Boolean) : null;
    document.querySelectorAll('.mp-admin-card').forEach(function (card) {
      var matchQ  = !q || (card.dataset.search || '').indexOf(q) !== -1;
      var uid2    = card.dataset.uid || '';
      var matchTM = !tmUIDs || tmUIDs.indexOf(uid2) !== -1;
      card.style.display = (matchQ && matchTM) ? '' : 'none';
    });
  };
  window.mpAdminClearFilters = function () {
    var s = document.getElementById('admin-search'); if (s) s.value = '';
    var tm = document.getElementById('admin-team-filter'); if (tm) tm.selectedIndex = 0;
    mpAdminFilter();
  };
  window.mpAdminRowChecked = function () {
    var checked = document.querySelectorAll('.admin-row-cb:checked');
    var bar = document.getElementById('admin-sel-bar'), cnt = document.getElementById('admin-sel-count');
    var to  = document.getElementById('admin-email-to');
    if (bar) bar.style.display = checked.length ? 'flex' : 'none';
    if (cnt) cnt.textContent = checked.length + ' selected';
    if (to)  to.value = Array.from(checked).map(function (c) { return c.value; }).join(', ');
  };
  window.mpAdminSelectAll = function (cb) {
    document.querySelectorAll('.mp-admin-card:not([style*="display: none"]) .admin-row-cb').forEach(function (c) { c.checked = cb.checked; });
    mpAdminRowChecked();
  };
  window.mpAdminOpenCompose = function () {
    var p = document.getElementById('admin-compose-panel'); if (p) { p.style.display = ''; p.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  };
  window.mpAdminCopyEmails = function () {
    var to = document.getElementById('admin-email-to'); if (!to || !to.value) return;
    navigator.clipboard.writeText(to.value).then(function () {
      var btn = document.getElementById('admin-copy-btn'); if (btn) { var o = btn.textContent; btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = o; }, 2000); }
    });
  };
  window.mpAdminClearSel = function () {
    document.querySelectorAll('.admin-row-cb').forEach(function (c) { c.checked = false; });
    var all = document.getElementById('admin-sel-all'); if (all) all.checked = false;
    mpAdminRowChecked();
  };
  window.mpAdminEdit = function (uid) {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'admin'); url.searchParams.set('admin_edit', uid);
    window.history.pushState({}, '', url.toString());
    renderAdminTab();
  };
  window.mpAdminBackToList = function () {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'admin'); url.searchParams.delete('admin_edit');
    window.history.pushState({}, '', url.toString());
    renderAdminTab();
  };
  window.mpAdminToggleDir = async function (uid, action) {
    var _sb2 = window.mpDashboard.getSb();
    await _sb2.from('profiles').update({ show_in_directory: action === 'show' }).eq('id', uid);
    renderAdminTab();
  };
  window.mpAdminUnlinkSpouse = async function (uid, name) {
    if (!confirm('Unlink ' + name + ' and their spouse?')) return;
    var _sb2 = window.mpDashboard.getSb();
    await _sb2.rpc('unlink_spouses', { p_uid: uid });
    renderAdminTab();
  };
  window.mpAdminDeleteUser = async function (uid, name) {
    var D = window.mpDashboard;
    var _sb2 = D.getSb();
    /* guard: an admin may not delete their own account */
    var me = D.getProfile();
    if (me && me.id === uid) { alert("You can't delete your own account."); return; }
    /* guard: admin accounts can't be deleted here — re-check role from the DB
       so a stale UI state can never let an admin slip through */
    var { data: target } = await _sb2.from('profiles').select('role').eq('id', uid).single();
    if (target && target.role === 'admin') {
      alert("Admin accounts can't be deleted here.\n\nChange this person's role to Member or Team Leader first, then delete.");
      return;
    }
    if (!confirm('Permanently delete the account for ' + name + '?\n\nThis will remove all their data including family links, team memberships, and schedule assignments. This cannot be undone.')) return;
    var { error } = await _sb2.from('profiles').delete().eq('id', uid);
    if (error) { alert('Error deleting account: ' + error.message); return; }
    window.mpDashboard.loadPendingBadge();
    renderAdminTab();
  };

  /* ── Admin member edit form ── */
  async function renderAdminMemberEdit(editUid) {
    var D = window.mpDashboard;
    var _sb = D.getSb();

    var [profRes, childRes, teamRes, allTeamsRes] = await Promise.all([
      _sb.from('profiles').select('*').eq('id', editUid).single(),
      _sb.from('children').select('*').eq('profile_id', editUid).order('id'),
      _sb.from('team_members').select('team_id').eq('member_id', editUid),
      _sb.from('teams').select('id,name').order('name')
    ]);
    var ep = profRes.data;
    if (!ep) { D.setContent('<p class="mp-empty">Member not found.</p>'); return; }
    var children    = childRes.data || [];
    var myTeamIds   = (teamRes.data || []).map(function (r) { return r.team_id; });
    var allTeams    = allTeamsRes.data || [];
    var mname       = ((ep.first_name || '') + (ep.last_name ? ' ' + ep.last_name : '')).trim() || ep.full_name || ep.email;

    var html = '<div class="mp-admin-edit-header"><a href="#" class="mp-admin-back-link" onclick="mpAdminBackToList();return false;">← Back to Members</a>';
    html += '<h2 class="mp-tab-title" style="margin:0;">Editing: ' + D.esc(mname) + '</h2></div>';

    var result = window._adminEditResult || null; window._adminEditResult = null;
    if (result && result.errors) html += D.alertHtml(result.errors.map(D.esc).join('<br>'), 'error');
    if (result && result.success) html += D.alertHtml('Profile updated for ' + D.esc(mname) + '.', 'success');

    html += '<form id="admin-edit-form" class="mp-form">';
    html += '<input type="hidden" name="edit_uid" value="' + D.esc(editUid) + '">';
    html += '<div class="mp-form-row"><div class="mp-form-group"><label>First Name <span class="mp-required">*</span></label><input type="text" name="first_name" value="' + D.esc(ep.first_name || '') + '" required></div><div class="mp-form-group"><label>Last Name <span class="mp-required">*</span></label><input type="text" name="last_name" value="' + D.esc(ep.last_name || '') + '" required></div></div>';
    html += '<div class="mp-form-group"><label>Email <span class="mp-required">*</span></label><input type="email" name="email" value="' + D.esc(ep.email || '') + '" required></div>';
    html += '<div class="mp-form-group"><label>Primary Phone</label><div class="mp-phone-wrap">' + D.phoneSelect('phone1_type', ep.phone1_type || 'Cell') + '<input type="tel" name="phone1" value="' + D.esc(ep.phone1 || '') + '" class="mp-phone-input" maxlength="12" placeholder="204-555-0100" oninput="this.value=window.mpFmtPh(this.value)"></div></div>';
    html += '<div class="mp-form-group"><label>Second Phone</label><div class="mp-phone-wrap">' + D.phoneSelect('phone2_type', ep.phone2_type || 'Home') + '<input type="tel" name="phone2" value="' + D.esc(ep.phone2 || '') + '" class="mp-phone-input" maxlength="12" oninput="this.value=window.mpFmtPh(this.value)"></div></div>';
    html += '<div class="mp-form-group"><label>Street Address</label><input type="text" name="addr_street" value="' + D.esc(ep.addr_street || '') + '"></div>';
    html += '<div class="mp-form-row"><div class="mp-form-group"><label>City</label><input type="text" name="addr_city" value="' + D.esc(ep.addr_city || 'Winnipeg') + '"></div><div class="mp-form-group"><label>Province</label>' + D.provinceSelect('addr_province', ep.addr_province || 'MB') + '</div></div>';
    html += '<div class="mp-form-row"><div class="mp-form-group"><label>Postal Code</label><input type="text" name="addr_postal" value="' + D.esc(ep.addr_postal || '') + '" maxlength="7"></div><div class="mp-form-group"><label>Country</label><input type="text" name="addr_country" value="' + D.esc(ep.addr_country || 'Canada') + '"></div></div>';
    html += '<div class="mp-form-row"><div class="mp-form-group"><label>Birthday</label><input type="date" name="birthday" value="' + D.esc(ep.birthday || '') + '"></div><div class="mp-form-group"><label>Anniversary</label><input type="date" name="anniversary" value="' + D.esc(ep.anniversary || '') + '"></div></div>';
    html += '<div class="mp-form-group"><label>Gender</label><select name="gender"><option value="">-- Not specified --</option><option value="male"' + (ep.gender === 'male' ? ' selected' : '') + '>Male</option><option value="female"' + (ep.gender === 'female' ? ' selected' : '') + '>Female</option></select></div>';
    html += '<div class="mp-form-group"><label>Show in Directory</label><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" name="show_in_directory" value="1"' + (ep.show_in_directory !== false ? ' checked' : '') + '> <span>Visible in member directory</span></label></div>';
    html += '<div class="mp-form-group"><label>About <span class="mp-optional">(Optional)</span></label><textarea name="bio" rows="3">' + D.esc(ep.bio || '') + '</textarea></div>';

    /* team assignments */
    if (allTeams.length) {
      html += '<div class="mp-section-divider">Team Assignments</div>';
      html += '<div class="mp-form-group"><div class="mp-group-member-picker">';
      allTeams.forEach(function (t) {
        html += '<label class="mp-group-member-check"><input type="checkbox" name="team_ids" value="' + D.esc(t.id) + '"' + (myTeamIds.indexOf(t.id) !== -1 ? ' checked' : '') + '> ' + D.esc(t.name) + '</label>';
      });
      html += '</div></div>';
    }

    /* children */
    var kidsRows = children.concat([{ name: '', gender: 'boy', birthday: '' }]);
    html += '<div class="mp-section-divider">Family</div>';
    html += '<div class="mp-form-group"><label>Children</label><div id="admin-children-list">';
    kidsRows.forEach(function (ch, i) {
      html += '<div class="mp-child-row" data-index="' + i + '" data-id="' + D.esc(ch.id || '') + '">';
      html += '<select name="ch[' + i + '][gender]" class="mp-child-gender"><option value="boy"' + (ch.gender !== 'girl' ? ' selected' : '') + '>Boy</option><option value="girl"' + (ch.gender === 'girl' ? ' selected' : '') + '>Girl</option></select>';
      html += '<input type="text" name="ch[' + i + '][name]" value="' + D.esc(ch.name || '') + '" placeholder="Child\'s name" class="mp-child-name">';
      html += '<input type="date" name="ch[' + i + '][birthday]" value="' + D.esc(ch.birthday || '') + '" class="mp-child-birthday">';
      if (ch.name) html += '<button type="button" class="mp-btn mp-btn--danger mp-btn--small" onclick="mpAdminRemoveChild(this)">Remove</button>';
      else         html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpAdminSaveChild(this)">+ Add</button>';
      html += '</div>';
    });
    html += '</div><span class="mp-hint">Click Remove to delete, or fill in the blank row and click + Add.</span></div>';

    /* password reset */
    /* Role assignment */
    html += '<div class="mp-section-divider">Role</div>';
    html += '<div class="mp-form-group"><label>Portal Role</label>';
    html += '<select name="role">';
    html += '<option value="member"' + (ep.role === 'member' ? ' selected' : '') + '>Member — standard access</option>';
    html += '<option value="team"'   + (ep.role === 'team'   ? ' selected' : '') + '>Team Leader — can edit their MC/Team, manage schedule, upload files, send team emails</option>';
    html += '<option value="admin"'  + (ep.role === 'admin'  ? ' selected' : '') + '>Admin — full access</option>';
    html += '</select>';
    html += '<span class="mp-hint">Changing role takes effect on their next login.</span></div>';

    html += '<div class="mp-form-group"><label>Reset Password <span class="mp-optional">(Optional)</span></label><input type="password" name="new_password" placeholder="New password (min 8 chars)" minlength="8" autocomplete="new-password"><span class="mp-hint">Leave blank to keep current password.</span></div>';

    html += '<input type="hidden" name="stay_edit" id="admin-stay-edit" value="">';
    html += '<div style="display:flex;gap:12px;margin-top:8px;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">Save Changes</button><a href="#" class="mp-btn mp-btn--secondary" onclick="mpAdminBackToList();return false;">Cancel</a></div>';
    html += '</form>';

    html += '<div style="margin-top:32px;border:1px solid #fca5a5;border-radius:8px;overflow:hidden;">';
    html += '<div style="background:#fee2e2;padding:10px 16px;font-weight:700;font-size:0.88rem;color:#991b1b;display:flex;align-items:center;gap:7px;">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    html += 'Danger Zone</div>';
    html += '<div style="padding:14px 16px;background:#fff;">';
    if (ep.role === 'admin') {
      html += '<p style="margin:0 0 12px;font-size:0.87rem;color:#374151;">This is an <strong>admin account</strong> and can\'t be deleted. To remove it, first change the Portal Role above to Member or Team Leader and save, then return here to delete.</p>';
      html += '<button type="button" class="mp-btn mp-btn--danger" disabled title="Change the role to Member first.">Delete Account</button>';
    } else {
      html += '<p style="margin:0 0 12px;font-size:0.87rem;color:#374151;">Permanently delete this account and all associated data (family links, team memberships, schedule assignments). <strong>This cannot be undone.</strong></p>';
      html += '<button type="button" class="mp-btn mp-btn--danger" onclick="mpAdminDeleteUser(\'' + D.esc(editUid) + '\',\'' + D.esc(mname) + '\')">Delete Account</button>';
    }
    html += '</div></div>';

    D.setContent(html);

    var form = document.getElementById('admin-edit-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var uid = fd.get('edit_uid');
        var updates = {
          first_name: fd.get('first_name') || '', last_name: fd.get('last_name') || '',
          full_name: ((fd.get('first_name') || '') + ' ' + (fd.get('last_name') || '')).trim(),
          email: fd.get('email') || '', phone1_type: fd.get('phone1_type') || 'Cell',
          phone1: fd.get('phone1') || '', phone2_type: fd.get('phone2_type') || 'Home', phone2: fd.get('phone2') || '',
          addr_street: fd.get('addr_street') || '', addr_city: fd.get('addr_city') || '',
          addr_province: fd.get('addr_province') || '', addr_postal: fd.get('addr_postal') || '',
          addr_country: fd.get('addr_country') || 'Canada',
          birthday: fd.get('birthday') || null, anniversary: fd.get('anniversary') || null,
          gender: fd.get('gender') || '', bio: fd.get('bio') || '',
          show_in_directory: fd.get('show_in_directory') === '1',
          role: ['member','team','admin'].indexOf(fd.get('role') || 'member') !== -1 ? fd.get('role') : 'member'
        };
        updates.address = [updates.addr_street, updates.addr_city, updates.addr_province, updates.addr_postal, updates.addr_country].filter(Boolean).join(', ');
        var { error } = await _sb.from('profiles').update(updates).eq('id', uid);

        /* team reconciliation — only touch member-type rows so child/nonmember
           rows (which reference this uid as a parent) are not wiped */
        var newTeamIds = fd.getAll('team_ids');
        var delTm = _sb.from('team_members').delete().eq('member_id', uid);
        /* if the extended schema is in place, scope the delete to member-type only */
        try { delTm = delTm.or('member_type.is.null,member_type.eq.member'); } catch(e) { /* column may not exist yet */ }
        await delTm;
        if (newTeamIds.length) {
          var tmIns = await _sb.from('team_members').insert(newTeamIds.map(function (tid) { return { team_id: tid, member_id: uid, role: 'member', member_type: 'member' }; }));
          if (tmIns.error) {
            /* retry without the extended column if it's missing, then surface any
               real failure instead of swallowing it */
            var colMissing = tmIns.error.message && tmIns.error.message.indexOf('column') !== -1;
            var tmIns2 = colMissing
              ? await _sb.from('team_members').insert(newTeamIds.map(function (tid) { return { team_id: tid, member_id: uid, role: 'member' }; }))
              : tmIns;
            if (tmIns2.error) alert('Profile saved, but team assignments could not be updated: ' + tmIns2.error.message);
          }
        }

        /* children — read from DOM, save via the atomic save_children() RPC.
           One server-side transaction handles the whole add/update/remove
           diff, so a partial failure can never wipe a family's children
           without replacing them (the old direct delete+insert could). */
        var childList = document.querySelectorAll('#admin-children-list .mp-child-row');
        if (!childList.length) {
          console.warn('admin-children-list not found in DOM — skipping children save to avoid data loss');
        } else {
          var newChildren = [];
          childList.forEach(function (row) {
            var nameEl = row.querySelector('.mp-child-name'), genEl = row.querySelector('.mp-child-gender'), bdEl = row.querySelector('.mp-child-birthday');
            var cn = (nameEl && nameEl.value || '').trim(); if (!cn) return;
            newChildren.push({ id: row.dataset.id || null, name: cn, gender: (genEl && genEl.value) || 'boy', birthday: (bdEl && bdEl.value) || null });
          });
          var { error: childErr } = await D.getSb().rpc('save_children', { p_profile_id: uid, p_children: newChildren });
          if (childErr) { window._adminEditResult = { errors: [childErr.message] }; renderAdminTab(); return; }
        }

        /* password */
        var npw = fd.get('new_password') || '';
        if (npw && npw.length >= 8) {
          /* admin password reset requires service role — log a note */
          console.log('Admin password reset for', uid, '— requires service role key in edge function.');
        }

        if (error) { window._adminEditResult = { errors: [error.message] }; renderAdminTab(); return; }
        window._adminEditResult = { success: true };
        var url = new URL(window.location.href); url.searchParams.set('tab', 'admin'); url.searchParams.delete('admin_edit');
        window.history.pushState({}, '', url.toString());
        renderAdminTab();
      });
    }

    window.mpAdminSaveChild = function (btn) {
      var row = btn.closest('.mp-child-row'), n = row.querySelector('.mp-child-name');
      if (!n || !n.value.trim()) { n.focus(); n.style.borderColor = '#c0392b'; setTimeout(function () { n.style.borderColor = ''; }, 2000); return; }
      document.getElementById('admin-stay-edit').value = '1';
      btn.closest('form').dispatchEvent(new Event('submit', { bubbles: true }));
    };
    window.mpAdminRemoveChild = function (btn) {
      if (!confirm('Remove this child?')) return;
      var row = btn.closest('.mp-child-row'), n = row.querySelector('.mp-child-name');
      if (n) n.value = '';
      document.getElementById('admin-stay-edit').value = '1';
      btn.closest('form').dispatchEvent(new Event('submit', { bubbles: true }));
    };
  }

  /* ══════════════════════════════════════════════════════════════
     TAB: EMAIL (admin only)
     ══════════════════════════════════════════════════════════════ */
  async function renderEmailTab() {
    var D = window.mpDashboard;
    var _isAdmin  = D.isAdmin();
    var _isLeader = D.isLeader();
    var _ledTeamIds = D.getLedTeams();
    if (!_isLeader) { D.setContent('<p class="mp-empty">Access denied.</p>'); return; }
    var _sb = D.getSb();

    var [rostersRes, membersRes, mcsRes, teamsRes, logRes, settingsRes] = await Promise.all([
      _sb.from('schedule_rosters').select('date,title').order('date', { ascending: false }).limit(20),
      _sb.from('profiles').select('id,first_name,last_name,full_name,email').eq('status', 'approved').order('last_name'),
      _sb.from('missional_communities').select('id,name'),
      _sb.from('teams').select('id,name'),
      _isAdmin ? _sb.from('sent_email_log').select('*').order('sent_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
      _isAdmin ? _sb.from('portal_settings').select('key,value') : Promise.resolve({ data: [] })
    ]);
    var rosters = rostersRes.data || [];
    /* leaders only see their team members by default */
    var allMembers = membersRes.data || [];
    var members = _isAdmin ? allMembers : allMembers; /* leaders see all for now, chips default to team */
    var mcs     = mcsRes.data || [];
    var teams   = teamsRes.data || [];
    var sentLog = logRes.data || [];

    /* parse reminder schedule settings */
    var settingsMap = {};
    (settingsRes.data || []).forEach(function (r) { settingsMap[r.key] = r.value; });
    var curReminderDay  = parseInt(settingsMap.reminder_day  || '3', 10);
    var curReminderHour = parseInt(settingsMap.reminder_hour || '9', 10);

    /* build member email → name map for JS */
    var memberData = members.map(function (m) {
      return { e: m.email, n: ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || m.email };
    });

    var html = '<h2 class="mp-tab-title">Email</h2>';

    var qs = new URLSearchParams(window.location.search);
    if (qs.get('weekly_sent') === '1') html += D.alertHtml('Weekly email sent successfully.', 'success');
    if (qs.get('weekly_test_sent') === '1') html += D.alertHtml('Test email sent.', 'success');

    /* ── Reminder schedule settings (admin only) ── */
    if (_isAdmin) {
      var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      var dayOpts = dayNames.map(function (d, i) {
        return '<option value="' + i + '"' + (i === curReminderDay ? ' selected' : '') + '>' + d + '</option>';
      }).join('');
      var hourOpts = '';
      for (var h = 0; h < 24; h++) {
        var hLabel = h === 0 ? '12:00 AM' : h < 12 ? h + ':00 AM' : h === 12 ? '12:00 PM' : (h - 12) + ':00 PM';
        hourOpts += '<option value="' + h + '"' + (h === curReminderHour ? ' selected' : '') + '>' + hLabel + '</option>';
      }
      var nextDayLabel = dayNames[curReminderDay];
      var nextHourLabel = curReminderHour === 0 ? '12:00 AM' : curReminderHour < 12 ? curReminderHour + ':00 AM' : curReminderHour === 12 ? '12:00 PM' : (curReminderHour - 12) + ':00 PM';

      html += '<div class="mp-section-divider">Reminder Schedule</div>';
      html += '<details class="mp-admin-panel"><summary class="mp-admin-toggle">Configure Serving Reminders <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
      html += '<p class="mp-hint" style="margin-bottom:16px;">Reminders go out automatically each week to everyone on the schedule. Currently set for <strong>' + nextDayLabel + 's at ' + nextHourLabel + ' Central</strong>.</p>';
      html += '<form id="reminder-settings-form"><div class="mp-form-row">';
      html += '<div class="mp-form-group"><label>Day of Week</label><select name="reminder_day">' + dayOpts + '</select></div>';
      html += '<div class="mp-form-group"><label>Time (Central)</label><select name="reminder_hour">' + hourOpts + '</select></div>';
      html += '</div>';
      html += '<div style="display:flex;gap:10px;align-items:center;margin-top:4px;">';
      html += '<button type="submit" class="mp-btn mp-btn--primary" style="width:auto;">Save Schedule</button>';
      html += '<span class="mp-hint" style="margin:0;">Use "Send Reminders Now" on the Schedule tab to test immediately.</span>';
      html += '</div></form></div></details>';
    }

    /* ── Weekly email composer ── */
    html += '<div class="mp-section-divider">Weekly Church Email</div>';
    html += '<details class="mp-admin-panel"><summary class="mp-admin-toggle">Compose &amp; Send Weekly Email <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
    html += '<form id="weekly-email-form">';
    html += '<div class="mp-form-row" style="margin-bottom:16px;"><div class="mp-form-group"><label>Subject <span class="mp-required">*</span></label><input type="text" name="subject" required placeholder="Commissioned City Church — Weekly Email"></div>';
    html += '<div class="mp-form-group"><label>Include Serving Schedule For</label><select name="roster_date"><option value="">— No schedule —</option>';
    rosters.forEach(function (r) { html += '<option value="' + D.esc(r.date) + '">' + D.esc(r.date + ' — ' + (r.title || 'Sunday Service')) + '</option>'; });
    html += '</select></div></div>';
    html += '<div class="mp-form-group"><label>Email Body</label>';
    html += rteToolbar('weekly-rte', 'weekly-hidden', 'wkRte');
    html += '<div class="mp-rte-body mp-rte-body--tall" id="weekly-rte" contenteditable="true" data-placeholder="Write your email here…"></div>';
    html += '<textarea name="body" id="weekly-hidden" style="display:none;"></textarea></div>';
    html += '<p class="mp-hint">Sent to all approved members as BCC. The serving schedule (if selected) is appended automatically.</p>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">';
    html += '<button type="submit" class="mp-btn mp-btn--primary" style="flex:1;" onclick="wkRteSync()">Send Weekly Email</button>';
    html += '<button type="button" class="mp-btn mp-btn--secondary" onclick="wkRteSync();document.getElementById(\'weekly-test-modal\').style.display=\'flex\';">Send Test Email</button>';
    html += '</div></form></div></details>';

    /* test email modal */
    html += '<div id="weekly-test-modal" class="mp-modal-overlay" style="display:none;" onclick="if(event.target===this)this.style.display=\'none\'">';
    html += '<div class="mp-modal-box"><h3 class="mp-modal-title">Send Test Email</h3>';
    html += '<p class="mp-hint" style="margin-bottom:16px;">Preview this email sent to a single address.</p>';
    html += '<div class="mp-form-group"><label>Pick a Member</label><select id="test-member-sel" onchange="document.getElementById(\'test-email-inp\').value=this.value" style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:0.9em;font-family:inherit;"><option value="">— Select a member —</option>';
    members.forEach(function (m) {
      var mn = ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || '';
      html += '<option value="' + D.esc(m.email) + '">' + D.esc(mn + ' — ' + m.email) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="mp-form-group"><label>Send To <span class="mp-required">*</span></label><input type="email" id="test-email-inp" placeholder="email@example.com" style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:0.9em;font-family:inherit;box-sizing:border-box;"></div>';
    html += '<div style="display:flex;gap:10px;margin-top:8px;"><button type="button" class="mp-btn mp-btn--primary" style="flex:1;" onclick="wkSendTest()">Send Test</button><button type="button" class="mp-btn mp-btn--secondary" onclick="document.getElementById(\'weekly-test-modal\').style.display=\'none\';">Cancel</button></div>';
    html += '</div></div>';

    /* ── Special email composer ── */
    html += '<div class="mp-section-divider" style="margin-top:12px;">Special Email</div>';
    html += '<details class="mp-admin-panel"><summary class="mp-admin-toggle">Compose &amp; Send Special Email <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
    html += '<form id="special-email-form">';
    html += '<div class="mp-form-group"><label>Subject <span class="mp-required">*</span></label><input type="text" name="subject" required placeholder="Subject…"></div>';
    html += '<div class="mp-form-group"><label>Recipients</label>';
    html += '<div class="mp-special-recip-bar">';
    html += '<select id="sp-group-sel" onchange="spAddGroup(this)" style="flex:1;padding:8px 10px;border:1.5px solid var(--mp-border);border-radius:6px;font-size:0.88em;font-family:inherit;"><option value="">+ Add by group…</option><option value="all">All members</option>';
    if (mcs.length) { html += '<optgroup label="MCs">'; mcs.forEach(function (mc) { html += '<option value="mc:' + D.esc(mc.id) + '">' + D.esc(mc.name) + '</option>'; }); html += '</optgroup>'; }
    if (teams.length) { html += '<optgroup label="Teams">'; teams.forEach(function (t) { html += '<option value="team:' + D.esc(t.id) + '">' + D.esc(t.name) + '</option>'; }); html += '</optgroup>'; }
    html += '</select></div>';
    html += '<select id="sp-member-sel" onchange="spAddMember(this)" style="width:100%;margin-top:8px;padding:8px 10px;border:1.5px solid var(--mp-border);border-radius:6px;font-size:0.88em;font-family:inherit;"><option value="">+ Add individual member…</option>';
    members.forEach(function (m) {
      var mn = ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || '';
      html += '<option value="' + D.esc(m.email) + '" data-name="' + D.esc(mn) + '">' + D.esc(mn + ' — ' + m.email) + '</option>';
    });
    html += '</select>';
    html += '<div class="mp-special-chips" id="sp-chips"></div>';
    html += '<input type="hidden" name="recipients" id="sp-recip-hidden"><span class="mp-hint">Click a chip to remove a recipient.</span></div>';
    html += '<div class="mp-form-group"><label>Email Body</label>';
    html += rteToolbar('sp-rte', 'sp-hidden', 'spRte');
    html += '<div class="mp-rte-body mp-rte-body--tall" id="sp-rte" contenteditable="true" data-placeholder="Write your email here…"></div>';
    html += '<textarea name="body" id="sp-hidden" style="display:none;"></textarea></div>';
    html += '<div style="margin-top:16px;"><button type="submit" class="mp-btn mp-btn--primary" style="width:auto;" onclick="spRteSync()">Send Special Email</button></div>';
    html += '</form></div></details>';

    /* ── Sent log ── */
    html += '<div class="mp-section-divider" style="margin-top:40px;">Sent Email Log</div>';
    if (!sentLog.length) { html += '<p class="mp-empty">No emails sent yet.</p>'; }
    else {
      html += '<div class="mp-sent-log">';
      sentLog.forEach(function (entry) {
        var d = entry.sent_at ? new Date(entry.sent_at).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        html += '<div class="mp-sent-log-entry"><div class="mp-sent-log-meta">';
        html += '<span class="mp-sent-log-subject">' + D.esc(entry.subject || '(no subject)') + '</span>';
        html += '<span class="mp-sent-log-date">' + D.esc(d) + '</span>';
        if (entry.recipients && entry.recipients.length) html += '<span class="mp-sent-log-recip">' + entry.recipients.length + ' recipients</span>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    /* serialise member data for JS */
    html += '<script>window._spMemberData=' + JSON.stringify(memberData) + ';<\/script>';

    D.setContent(html);

    /* wire reminder settings form */
    var rsform = document.getElementById('reminder-settings-form');
    if (rsform) {
      rsform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(rsform);
        var day  = fd.get('reminder_day')  || '3';
        var hour = fd.get('reminder_hour') || '9';
        var _sb2 = D.getSb();
        await Promise.all([
          _sb2.from('portal_settings').upsert({ key: 'reminder_day',  value: day  }, { onConflict: 'key' }),
          _sb2.from('portal_settings').upsert({ key: 'reminder_hour', value: hour }, { onConflict: 'key' })
        ]);
        renderEmailTab();
      });
    }

    /* wire weekly form */
    var wform = document.getElementById('weekly-email-form');
    if (wform) {
      var wrte = document.getElementById('weekly-rte'), whid = document.getElementById('weekly-hidden');
      if (wrte && whid) wrte.addEventListener('input', function () { whid.value = wrte.innerHTML; });
      wform.addEventListener('submit', async function (e) {
        e.preventDefault();
        wkRteSync();
        var fd = new FormData(wform);
        var subject = fd.get('subject'), body = fd.get('body'), rdate = fd.get('roster_date') || '';
        if (!subject || !body) { alert('Subject and body are required.'); return; }
        var recips = members.map(function (m) { return m.email; });
        await D.callEdge('send-email', { action: 'weekly_church_email', subject, body, roster_date: rdate, recipients: recips });
        await D.getSb().from('sent_email_log').insert({ subject, body, recipients: recips, sent_by: (D.getProfile().first_name || 'Admin'), success: true, type: 'weekly' });
        var url = new URL(window.location.href); url.searchParams.set('weekly_sent', '1');
        window.history.replaceState({}, '', url.toString());
        renderEmailTab();
      });
    }

    /* wire special form */
    var sform = document.getElementById('special-email-form');
    if (sform) {
      var srte = document.getElementById('sp-rte'), shid = document.getElementById('sp-hidden');
      if (srte && shid) srte.addEventListener('input', function () { shid.value = srte.innerHTML; });
      sform.addEventListener('submit', async function (e) {
        e.preventDefault();
        spRteSync(); spSyncHidden();
        var fd = new FormData(sform);
        var subject = fd.get('subject'), body = fd.get('body'), recipRaw = fd.get('recipients') || '';
        if (!subject || !body || !recipRaw) { alert('Please fill in all fields and add at least one recipient.'); return; }
        var recips = recipRaw.split(',').filter(Boolean);
        await D.callEdge('send-email', { action: 'special_email', subject, body, recipients: recips });
        await D.getSb().from('sent_email_log').insert({ subject, body, recipients: recips, sent_by: (D.getProfile().first_name || 'Admin'), success: true, type: 'special' });
        alert('Email sent to ' + recips.length + ' recipient(s).');
        renderEmailTab();
      });
    }
  }

  /* weekly RTE globals */
  window.wkRteCmd  = function (cmd) { var b = document.getElementById('weekly-rte'); if (b) { b.focus(); document.execCommand(cmd, false, null); } wkRteSync(); };
  window.wkRteLink = function () {
    var b = document.getElementById('weekly-rte'); if (!b) return;
    var sel = window.getSelection(), saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var url = prompt('URL:', 'https://'); if (!url || url === 'https://') return;
    b.focus(); if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
    document.execCommand('createLink', false, url); wkRteSync();
  };
  window.wkRteSync = function () { var b = document.getElementById('weekly-rte'), h = document.getElementById('weekly-hidden'); if (b && h) h.value = b.innerHTML; };
  window.wkSendTest = async function () {
    wkRteSync();
    var email = document.getElementById('test-email-inp').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Please enter a valid email address.'); return; }
    var subject = document.querySelector('#weekly-email-form [name=subject]').value || 'Test';
    var body    = document.getElementById('weekly-hidden').value || '';
    var rdate   = document.querySelector('#weekly-email-form [name=roster_date]').value || '';
    await window.mpDashboard.callEdge('send-email', { action: 'weekly_church_email', subject: '[TEST] ' + subject, body, roster_date: rdate, recipients: [email] });
    document.getElementById('weekly-test-modal').style.display = 'none';
    alert('Test email sent to ' + email);
  };

  /* special email globals */
  var _spRecips = {};
  function spSyncHidden() {
    var h = document.getElementById('sp-recip-hidden'); if (h) h.value = Object.keys(_spRecips).join(',');
  }
  function spAddEmail(email, name) {
    email = email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (_spRecips[email]) return;
    _spRecips[email] = name || email;
    var chips = document.getElementById('sp-chips'); if (!chips) return;
    var chip = document.createElement('span'); chip.className = 'mp-special-chip'; chip.dataset.email = email;
    chip.innerHTML = '<span>' + window.mpDashboard.esc(_spRecips[email]) + '</span><button type="button" onclick="spRemove(\'' + email.replace(/'/g, "\\'") + '\',this.parentNode)">✕</button>';
    chips.appendChild(chip); spSyncHidden();
  }
  window.spRemove = function (email, chip) { delete _spRecips[email]; if (chip) chip.remove(); spSyncHidden(); };
  window.spAddMember = function (sel) {
    var opt = sel.options[sel.selectedIndex]; if (!opt || !opt.value) return;
    spAddEmail(opt.value, opt.dataset.name || opt.value); sel.selectedIndex = 0;
  };
  window.spAddGroup = function (sel) {
    var val = sel.value; if (!val) return; sel.selectedIndex = 0;
    var data = window._spMemberData || [];
    if (val === 'all') { data.forEach(function (d) { spAddEmail(d.e, d.n); }); return; }
    /* mc/team filtering done client-side via membership data fetched server-side at render */
    alert('Group email added. For MC/Team filtering, use the individual picker or the Admin tab compose panel.');
  };
  window.spRteCmd  = function (cmd) { var b = document.getElementById('sp-rte'); if (b) { b.focus(); document.execCommand(cmd, false, null); } spRteSync(); };
  window.spRteLink = function () {
    var b = document.getElementById('sp-rte'); if (!b) return;
    var sel = window.getSelection(), saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var url = prompt('URL:', 'https://'); if (!url || url === 'https://') return;
    b.focus(); if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
    document.execCommand('createLink', false, url); spRteSync();
  };
  window.spRteSync = function () { var b = document.getElementById('sp-rte'), h = document.getElementById('sp-hidden'); if (b && h) h.value = b.innerHTML; };

  /* ══════════════════════════════════════════════════════════════
     SHARED RTE GLOBALS — called from toolbar onclick attributes
     ══════════════════════════════════════════════════════════════ */
  window.rteSync = function (bId, hId) {
    var b = document.getElementById(bId), h = document.getElementById(hId);
    if (b && h) h.value = b.innerHTML;
  };

  window.rteExecCmd = function (bId, hId, cmd) {
    var b = document.getElementById(bId);
    if (b) { b.focus(); document.execCommand(cmd, false, null); }
    window.rteSync(bId, hId);
  };

  window.rteSetFont = function (bId, hId, fontName) {
    var b = document.getElementById(bId);
    if (b) { b.focus(); document.execCommand('fontName', false, fontName); }
    window.rteSync(bId, hId);
  };

  window.rteSizeStep = function (bId, hId, dispId, delta) {
    var disp = document.getElementById(dispId);
    if (!disp) return;
    var cur = parseInt(disp.textContent, 10) || 11;
    var idx = _RTE_SIZES.indexOf(cur);
    if (idx < 0) {
      for (var i = 0; i < _RTE_SIZES.length; i++) { if (_RTE_SIZES[i] >= cur) { idx = i; break; } }
      if (idx < 0) idx = 3;
    }
    idx = Math.max(0, Math.min(_RTE_SIZES.length - 1, idx + delta));
    var pt = _RTE_SIZES[idx];
    disp.textContent = pt;
    var b = document.getElementById(bId);
    if (!b) return;
    b.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      /* marker technique: stamp a font[size=7], then replace with inline pt style */
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontSize', false, '7');
      b.querySelectorAll('font[size="7"]').forEach(function (el) {
        el.removeAttribute('size');
        el.style.fontSize = pt + 'pt';
      });
    } else {
      /* no selection — set state for next typed character */
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontSize', false, _RTE_HTML_SIZE[idx]);
    }
    window.rteSync(bId, hId);
  };

  window.rteTogglePicker = function (pickerId) {
    document.querySelectorAll('.mp-rte-picker').forEach(function (p) {
      if (p.id !== pickerId) p.style.display = 'none';
    });
    var el = document.getElementById(pickerId);
    if (el) el.style.display = (el.style.display === 'none' ? 'block' : 'none');
  };

  window.rteApplyColor = function (bId, hId, type, color, indId, pickId) {
    var b = document.getElementById(bId);
    if (b) {
      b.focus();
      if (type === 'fore') {
        document.execCommand('foreColor', false, color);
      } else {
        if (color === 'transparent') {
          document.execCommand('hiliteColor', false, 'transparent');
        } else {
          document.execCommand('backColor', false, color);
        }
      }
    }
    var ind = document.getElementById(indId);
    if (ind) ind.style.background = color === 'transparent' ? '' : color;
    if (pickId) { var pick = document.getElementById(pickId); if (pick) pick.style.display = 'none'; }
    window.rteSync(bId, hId);
  };

  window.rteInsertLink = function (bId, hId) {
    var b = document.getElementById(bId); if (!b) return;
    var sel = window.getSelection();
    var saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var url = prompt('URL:', 'https://');
    if (!url || url === 'https://') return;
    b.focus();
    if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
    document.execCommand('createLink', false, url);
    window.rteSync(bId, hId);
  };

  window.rteInsertImage = function (bId, hId) {
    var b = document.getElementById(bId); if (!b) return;
    var url = prompt('Image URL:', 'https://');
    if (!url || url === 'https://') return;
    b.focus();
    document.execCommand('insertImage', false, url);
    window.rteSync(bId, hId);
  };

  window.rteLineSpacing = function (bId, hId, value) {
    var b = document.getElementById(bId); if (!b) return;
    b.focus();
    var sel = window.getSelection();
    var blocks = [];
    if (sel && sel.rangeCount) {
      var range = sel.getRangeAt(0);
      function nearestBlock(node) {
        while (node && node !== b) {
          if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/i.test(node.nodeName)) return node;
          node = node.parentNode;
        }
        return null;
      }
      var startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
      var endNode   = range.endContainer.nodeType === 3   ? range.endContainer.parentNode   : range.endContainer;
      var startBlock = nearestBlock(startNode);
      var endBlock   = nearestBlock(endNode);
      if (startBlock && startBlock === endBlock) {
        blocks = [startBlock];
      } else {
        var inside = false;
        Array.prototype.forEach.call(b.children, function (child) {
          if (child === startBlock) inside = true;
          if (inside) blocks.push(child);
          if (child === endBlock) inside = false;
        });
      }
    }
    if (!blocks.length) blocks = Array.prototype.slice.call(b.children);
    if (blocks.length) {
      blocks.forEach(function (el) { el.style.lineHeight = value; });
    } else {
      b.style.lineHeight = value;
    }
    window.rteSync(bId, hId);
  };

  /* close all pickers on outside click */
  document.addEventListener('mousedown', function (e) {
    if (!e.target.closest || (!e.target.closest('.mp-rte-color-btn-wrap') && !e.target.closest('.mp-rte-dropdown-wrap'))) {
      document.querySelectorAll('.mp-rte-picker').forEach(function (p) { p.style.display = 'none'; });
    }
  });

  /* also expose mpFmtPh if not already set */
  if (!window.mpFmtPh) {
    window.mpFmtPh = function (raw) {
      raw = (raw || '').replace(/\D/g, '').slice(0, 10);
      if (raw.length >= 7) return raw.slice(0, 3) + '-' + raw.slice(3, 6) + '-' + raw.slice(6);
      if (raw.length >= 4) return raw.slice(0, 3) + '-' + raw.slice(3);
      return raw;
    };
  }

})();
