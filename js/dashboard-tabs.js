/**
 * DASHBOARD MODULE — Part B: Directory, MCs, Teams tabs
 * Requires dashboard.js to be loaded first.
 */
(function () {
  'use strict';

  /* wait for core module then register renderers */
  var MAX_WAIT = 60, waited = 0;
  function tryRegister() {
    if (window.mpDashboard) {
      register();
    } else if (waited < MAX_WAIT) {
      waited++;
      setTimeout(tryRegister, 100);
    }
  }

  function register() {
    var D = window.mpDashboard;
    D.render_directory = renderDirectoryTab;
    D.render_mcs       = renderMCsTab;
    D.render_teams     = renderTeamsTab;
  }

  tryRegister();

  /* ══════════════════════════════════════════════════════════════
     TAB: DIRECTORY
     ══════════════════════════════════════════════════════════════ */
  async function renderDirectoryTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    var uid = _profile.id;

    /* fetch all approved members + their children */
    var q = _sb.from('profiles').select('*').eq('status', 'approved').order('last_name', { nullsFirst: false }).order('full_name');
    if (!_isAdmin) q = q.neq('show_in_directory', false);
    var { data: members } = await q;
    members = members || [];

    var { data: allChildren } = await _sb.from('children').select('*');
    var childrenByProfile = {};
    (allChildren || []).forEach(function (c) {
      if (!childrenByProfile[c.profile_id]) childrenByProfile[c.profile_id] = [];
      childrenByProfile[c.profile_id].push(c);
    });

    var [mcMemsRes, teamMemsRes] = await Promise.all([
      _sb.from('mc_members').select('profile_id, missional_communities(id,name)'),
      _sb.from('team_members').select('member_id, teams(id,name)')
    ]);
    var mcByProfile = {}, teamsByProfile = {};
    (mcMemsRes.data || []).forEach(function (r) {
      var n = r.missional_communities && r.missional_communities.name;
      if (!n) return;
      if (!mcByProfile[r.profile_id]) mcByProfile[r.profile_id] = [];
      mcByProfile[r.profile_id].push(n);
    });
    (teamMemsRes.data || []).forEach(function (r) {
      var n = r.teams && r.teams.name;
      if (!n) return;
      if (!teamsByProfile[r.member_id]) teamsByProfile[r.member_id] = [];
      teamsByProfile[r.member_id].push(n);
    });

    /* group into families */
    var families = [], seen = {};
    members.forEach(function (m) {
      if (seen[m.id]) return;
      var spouse = m.spouse_id ? members.find(function (x) { return x.id === m.spouse_id; }) : null;
      if (spouse && !seen[spouse.id]) {
        families.push({ type: 'couple', a: m, b: spouse });
        seen[m.id] = true; seen[spouse.id] = true;
      } else {
        families.push({ type: 'single', m: m });
        seen[m.id] = true;
      }
    });
    /* sort couples by husband's last name, singles by their own last name */
    function coupleSortKey(fam) {
      var h = (fam.a.gender === 'male' && fam.a.last_name) ? fam.a
            : (fam.b.gender === 'male' && fam.b.last_name) ? fam.b : null;
      if (h) return h.last_name.toLowerCase();
      var names = [fam.a.last_name, fam.b.last_name].filter(Boolean).map(function (s) { return s.toLowerCase(); }).sort();
      return names[0] || '';
    }
    families.sort(function (fa, fb) {
      var ka = fa.type === 'couple' ? coupleSortKey(fa) : (fa.m.last_name || fa.m.full_name || '').toLowerCase();
      var kb = fb.type === 'couple' ? coupleSortKey(fb) : (fb.m.last_name || fb.m.full_name || '').toLowerCase();
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    /* build card data array */
    var cards = families.map(function (fam) {
      if (fam.type === 'couple') {
        var a = fam.a, b = fam.b;
        var label = D.coupleDisplayName(a, b);
        var al = a.last_name || '', bl = b.last_name || '';
        /* family name: husband's last name → "Cattani Family" */
        var husband = (a.gender === 'male' && a.last_name) ? a
                    : (b.gender === 'male' && b.last_name) ? b : null;
        var famLabel = husband ? husband.last_name + ' Family'
                    : (al && bl && al.toLowerCase() === bl.toLowerCase()) ? al + ' Family'
                    : label;
        var kidsA = childrenByProfile[a.id] || [], kidsB = childrenByProfile[b.id] || [];
        var allKids = kidsA.concat(kidsB.filter(function (kb) {
          return !kidsA.some(function (ka) { return ka.name.toLowerCase() === kb.name.toLowerCase(); });
        }));
        return {
          type: 'couple', label: label, famLabel: famLabel,
          search: (label + ' ' + al + ' ' + bl + ' '
            + (mcByProfile[a.id]    || []).join(' ') + ' '
            + (mcByProfile[b.id]    || []).join(' ') + ' '
            + (teamsByProfile[a.id] || []).join(' ') + ' '
            + (teamsByProfile[b.id] || []).join(' ')).toLowerCase(),
          a: memberData(a, mcByProfile, teamsByProfile), b: memberData(b, mcByProfile, teamsByProfile),
          address: a.address || b.address || '',
          anniversary: D.fmtDate(a.anniversary || b.anniversary || ''),
          children: allKids
        };
      } else {
        var m = fam.m;
        return {
          type: 'single', label: D.getInitials(m),
          name: ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || m.email,
          search: ((m.first_name || '') + ' ' + (m.last_name || '') + ' ' + (m.full_name || '') + ' '
            + (m.email || '') + ' '
            + (mcByProfile[m.id]    || []).join(' ') + ' '
            + (teamsByProfile[m.id] || []).join(' ')).toLowerCase(),
          m: memberData(m, mcByProfile, teamsByProfile),
          address: m.address || '', anniversary: D.fmtDate(m.anniversary || ''),
          children: childrenByProfile[m.id] || []
        };
      }
    });

    /* serialize to JSON for client-side filtering */
    var json = JSON.stringify(cards).replace(/</g, '\\u003c');

    var html = '<h2 class="mp-tab-title">Member Directory</h2>';
    html += '<div class="mp-dir-controls">';
    html += '<input type="text" id="dir-search" placeholder="Search members…" class="mp-search-input" oninput="mpDirFilter(this.value)">';
    html += '<div class="mp-dir-perpage-wrap"><label class="mp-dir-perpage-label">Show</label>';
    html += '<select id="dir-pp" class="mp-dir-perpage-select" onchange="mpDirSetPP(this.value)"><option value="10" selected>10</option><option value="20">20</option><option value="all">All</option></select>';
    html += '<span class="mp-dir-perpage-label">per page</span></div></div>';
    html += '<script type="application/json" id="dir-json">' + json + '<\/script>';
    html += '<div id="mp-directory"></div>';
    html += '<div id="dir-pag" class="mp-dir-pagination" style="display:none;">';
    html += '<button class="mp-btn mp-btn--secondary mp-btn--small" id="dir-prev" onclick="mpDirPrev()">← Previous</button>';
    html += '<span class="mp-dir-page-info" id="dir-info"></span>';
    html += '<button class="mp-btn mp-btn--secondary mp-btn--small" id="dir-next" onclick="mpDirNext()">Next →</button>';
    html += '</div>';

    D.setContent(html);
    initDirJS();
  }

  function memberData(m, mcMap, teamsMap) {
    mcMap    = mcMap    || {};
    teamsMap = teamsMap || {};
    return {
      id: m.id, photo: m.avatar_url || '',
      initials: window.mpDashboard.getInitials(m),
      name: ((m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')).trim() || m.full_name || m.email,
      last_name: m.last_name || '', gender: m.gender || '',
      email: m.email || '', phone1: m.phone1 || '', phone1_type: m.phone1_type || 'Cell',
      phone2: m.phone2 || '', phone2_type: m.phone2_type || 'Home',
      birthday: window.mpDashboard.fmtDate(m.birthday || ''), bio: m.bio || '',
      mcs:   (mcMap[m.id]    || []).slice(),
      teams: (teamsMap[m.id] || []).slice()
    };
  }

  function initDirJS() {
    var all = [];
    try { var el = document.getElementById('dir-json'); all = JSON.parse(el ? el.textContent : '[]') || []; }
    catch (e) { document.getElementById('mp-directory').innerHTML = '<p class="mp-empty">Could not load directory.</p>'; return; }

    var fil = all.slice(), pg = 1, pp = 10;
    var D = window.mpDashboard;

    function gpp() { return pp === 'all' ? Math.max(fil.length, 1) : parseInt(pp, 10); }
    function tp()  { return pp === 'all' ? 1 : Math.max(1, Math.ceil(fil.length / parseInt(pp, 10))); }

    function av(photo, initials, name) {
      var label = name || initials;
      if (photo) {
        var enc = encodeURIComponent(photo);
        return '<div class="mp-dir-thumb" onclick="mpDirLightbox(decodeURIComponent(\'' + enc + '\'))">'
          + '<img src="' + D.esc(photo) + '" alt="' + D.esc(label) + '" class="mp-dir-thumb-img"></div>';
      }
      return '<div class="mp-dir-thumb mp-dir-thumb--initials">' + D.esc(initials) + '</div>';
    }

    function dlTbl(rows) {
      if (!rows) return '';
      return '<div class="mp-dir-detail"><table class="mp-dir-dl-table">' + rows + '</table></div>';
    }
    function dlR(lbl, val) {
      if (!val) return '';
      return '<tr><td class="mp-dir-dl-label">' + lbl + '</td><td class="mp-dir-dl-gap"></td><td class="mp-dir-dl-val">' + val + '</td></tr>';
    }
    function personBlock(p) {
      var rows = '';
      if (p.email) rows += dlR('Email', '<a href="mailto:' + D.esc(p.email) + '">' + D.esc(p.email) + '</a>');
      if (p.phone1) rows += dlR(D.esc(p.phone1_type || 'Cell'), D.esc(p.phone1));
      if (p.phone2) rows += dlR(D.esc(p.phone2_type || 'Home'), D.esc(p.phone2));
      if (p.birthday) rows += dlR('Birthday', D.esc(p.birthday));
      if (p.bio) rows += dlR('About', D.esc(p.bio));
      if (p.mcs   && p.mcs.length)   rows += dlR('MC',    D.esc(p.mcs.join(', ')));
      if (p.teams && p.teams.length) rows += dlR('Teams', D.esc(p.teams.join(', ')));
      return '<div class="mp-dir-person-block"><div class="mp-dir-person-row">'
        + av(p.photo, p.initials, p.name) + '<span class="mp-dir-person-name">' + D.esc(p.name) + '</span></div>'
        + (rows ? dlTbl(rows) : '') + '</div>';
    }
    function sharedBlock(card) {
      var rows = '';
      if (card.address) rows += dlR('Address', D.esc(card.address));
      if (card.anniversary) rows += dlR('Anniversary', D.esc(card.anniversary));
      if (card.children && card.children.length) {
        var clist = card.children.filter(function (k) { return k.name; }).map(function (k) {
          return D.esc(k.name) + ' (' + (k.gender === 'girl' ? 'Girl' : 'Boy') + ')' + (k.birthday ? ' — ' + D.esc(D.fmtDate(k.birthday)) : '');
        }).join('<br>');
        if (clist) rows += dlR('Children', clist);
      }
      return rows ? '<div class="mp-dir-shared-block">' + dlTbl(rows) + '</div>' : '';
    }

    function render() {
      var c = document.getElementById('mp-directory'), pag = document.getElementById('dir-pag');
      if (!c) return;
      if (!fil.length) { c.innerHTML = '<p class="mp-empty">No members found.</p>'; if (pag) pag.style.display = 'none'; return; }
      var gp = gpp(), st = (pg - 1) * gp, en = Math.min(st + gp, fil.length), page = fil.slice(st, en), html = '';
      page.forEach(function (m) {
        html += '<details class="mp-dir-accordion">';
        if (m.type === 'couple') {
          html += '<summary class="mp-dir-accordion-header">' + D.esc(m.famLabel || m.label) + '</summary>';
          html += '<div class="mp-dir-accordion-body">';
          html += personBlock(m.a) + personBlock(m.b) + sharedBlock(m);
          html += '</div>';
        } else {
          html += '<summary class="mp-dir-accordion-header">' + D.esc(m.name) + '</summary>';
          html += '<div class="mp-dir-accordion-body"><div class="mp-dir-person-row">' + av(m.m.photo, m.m.initials, m.name) + '<span class="mp-dir-person-name">' + D.esc(m.name) + '</span></div>';
          var rows = '';
          if (m.m.email) rows += dlR('Email', '<a href="mailto:' + D.esc(m.m.email) + '">' + D.esc(m.m.email) + '</a>');
          if (m.m.phone1) rows += dlR(D.esc(m.m.phone1_type || 'Cell'), D.esc(m.m.phone1));
          if (m.m.phone2) rows += dlR(D.esc(m.m.phone2_type || 'Home'), D.esc(m.m.phone2));
          if (m.address) rows += dlR('Address', D.esc(m.address));
          if (m.m.birthday) rows += dlR('Birthday', D.esc(m.m.birthday));
          if (m.anniversary) rows += dlR('Anniversary', D.esc(m.anniversary));
          if (m.children && m.children.length) {
            var clist = m.children.filter(function (k) { return k.name; }).map(function (k) {
              return D.esc(k.name) + ' (' + (k.gender === 'girl' ? 'Girl' : 'Boy') + ')' + (k.birthday ? ' — ' + D.esc(D.fmtDate(k.birthday)) : '');
            }).join('<br>');
            if (clist) rows += dlR('Children', clist);
          }
          if (m.m.bio) rows += dlR('About', D.esc(m.m.bio));
          if (m.m.mcs   && m.m.mcs.length)   rows += dlR('MC',    D.esc(m.m.mcs.join(', ')));
          if (m.m.teams && m.m.teams.length) rows += dlR('Teams', D.esc(m.m.teams.join(', ')));
          if (rows) html += dlTbl(rows);
          html += '</div>';
        }
        html += '</details>';
      });
      c.innerHTML = html;
      var t = tp(), sp = pp !== 'all' && t > 1;
      if (pag) pag.style.display = sp ? 'flex' : 'none';
      var prev = document.getElementById('dir-prev'), next = document.getElementById('dir-next'), info = document.getElementById('dir-info');
      if (prev) prev.disabled = pg <= 1; if (next) next.disabled = pg >= t;
      if (info) info.textContent = 'Page ' + pg + ' of ' + t + ' (' + fil.length + ' entries)';
    }

    /* lightbox */
    window.mpDirLightbox = function (src) {
      var ov = document.getElementById('mp-dir-lightbox');
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'mp-dir-lightbox'; ov.className = 'mp-dir-lightbox';
        var bd = document.createElement('div'); bd.className = 'mp-dir-lightbox-backdrop';
        var box = document.createElement('div'); box.className = 'mp-dir-lightbox-inner';
        var img = document.createElement('img'); img.id = 'mp-dir-lb-img'; img.alt = '';
        var btn = document.createElement('button'); btn.className = 'mp-dir-lightbox-close'; btn.innerHTML = '✕';
        btn.onclick = function () { ov.style.display = 'none'; };
        box.appendChild(img); box.appendChild(btn); ov.appendChild(bd); ov.appendChild(box);
        bd.addEventListener('click', function () { ov.style.display = 'none'; });
        document.body.appendChild(ov);
      }
      document.getElementById('mp-dir-lb-img').src = src; ov.style.display = 'flex';
    };

    window.mpDirFilter = function (q) {
      q = (q || '').toLowerCase().trim();
      fil = q ? all.filter(function (m) { return (m.search || '').indexOf(q) !== -1; }) : all.slice();
      pg = 1; render();
    };
    window.mpDirSetPP = function (v) { pp = v === 'all' ? 'all' : parseInt(v, 10); pg = 1; render(); };
    window.mpDirPrev = function () { if (pg > 1) { pg--; render(); var el = document.getElementById('mp-directory'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' }); } };
    window.mpDirNext = function () { if (pg < tp()) { pg++; render(); var el = document.getElementById('mp-directory'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' }); } };

    render();
  }

  /* ══════════════════════════════════════════════════════════════
     TAB: MCs
     ══════════════════════════════════════════════════════════════ */
  async function renderMCsTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    var _isLeader = D.isLeader(), _ledMCIds = D.getLedMCs();
    var _canEdit  = _isAdmin || _isLeader;
    var uid = _profile.id;

    var [mcsRes, memRes, approvedRes] = await Promise.all([
      _sb.from('missional_communities').select('*').order('name'),
      _sb.from('mc_members').select('mc_id, profile_id, is_leader'),
      _canEdit ? _sb.from('profiles').select('id,first_name,last_name,full_name,email').eq('status','approved').order('last_name') : Promise.resolve({ data: [] })
    ]);
    var mcs      = mcsRes.data || [];
    var mcMems   = memRes.data || [];
    var approved = approvedRes.data || [];

    /* map mc_id → members */
    var mcMap = {};
    mcs.forEach(function (mc) { mcMap[mc.id] = []; });
    mcMems.forEach(function (mm) { if (mcMap[mm.mc_id]) mcMap[mm.mc_id].push(mm); });

    /* approved profiles map for fast lookup */
    var profMap = {};
    approved.forEach(function (p) { profMap[p.id] = p; });

    var editId = new URLSearchParams(window.location.search).get('mc_edit') || '';

    var html = '<h2 class="mp-tab-title">Missional Communities</h2>';

    /* admin: create or edit any MC; leader: edit only their own MC */
    if (_canEdit) {
      var editMc = editId ? mcs.find(function (mc) { return mc.id === editId; }) : null;
      /* leaders can only edit MCs they lead — skip the panel if editing a non-led MC */
      if (!_isAdmin && editMc && _ledMCIds.indexOf(editMc.id) === -1) editMc = null;
      var panelLabel = editMc ? 'Edit MC: ' + D.esc(editMc.name) : (_isAdmin ? 'Add New MC' : null);
      if (panelLabel) {
      html += '<details class="mp-admin-panel"' + (editMc ? ' open' : '') + '>';
      html += '<summary class="mp-admin-toggle">' + panelLabel + ' <span class="mp-admin-badge">' + (_isAdmin ? 'Admin' : 'Leader') + '</span></summary>';
      html += '<div class="mp-admin-body"><form id="mc-form">';
      html += '<input type="hidden" name="action_type" value="' + (editMc ? 'edit' : 'create') + '">';
      if (editMc) html += '<input type="hidden" name="mc_id" value="' + D.esc(editMc.id) + '">';
      html += '<div class="mp-form-row">';
      html += '<div class="mp-form-group"><label>MC Name <span class="mp-required">*</span></label><input type="text" name="mc_name" value="' + D.esc(editMc ? editMc.name : '') + '" required placeholder="e.g. The Garcias MC"></div>';
      html += '<div class="mp-form-group"><label>Leader</label><select name="leader_id"><option value="">-- No leader --</option>';
      approved.forEach(function (p) {
        var pn = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || p.email;
        html += '<option value="' + D.esc(p.id) + '"' + (editMc && editMc.leader_id === p.id ? ' selected' : '') + '>' + D.esc(pn) + '</option>';
      });
      html += '</select></div></div>';
      html += '<div class="mp-form-group"><label>Members</label><div class="mp-group-member-picker">';
      var editMcMemIds = editMc ? mcMap[editMc.id].map(function (mm) { return mm.profile_id; }) : [];
      approved.forEach(function (p) {
        var pn = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || p.email;
        html += '<label class="mp-group-member-check"><input type="checkbox" name="member_ids" value="' + D.esc(p.id) + '"' + (editMcMemIds.indexOf(p.id) !== -1 ? ' checked' : '') + '> ' + D.esc(pn) + '</label>';
      });
      html += '</div></div>';
      html += '<div style="display:flex;gap:10px;margin-top:16px;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">' + (editMc ? 'Save Changes' : 'Create MC') + '</button>';
      if (editMc) html += '<a href="#" class="mp-btn mp-btn--secondary" onclick="window.mpDashboard.navigate(\'mcs\');return false;">Cancel</a>';
      html += '</div></form></div></details>';
      }
    }

    if (!mcs.length) {
      html += '<p class="mp-empty">No Missional Communities have been set up yet.</p>';
    } else {
      html += '<div class="mp-group-accordion">';
      mcs.forEach(function (mc) {
        var mems     = mcMap[mc.id] || [];
        var isMine   = mems.some(function (mm) { return mm.profile_id === uid; }) || mc.leader_id === uid;
        var leader   = mc.leader_id ? approved.find(function (p) { return p.id === mc.leader_id; }) : null;
        var lName    = leader ? (((leader.first_name || '') + (leader.last_name ? ' ' + leader.last_name : '')).trim() || leader.full_name || '') : '';
        html += '<details class="mp-group-accordion-item' + (isMine ? ' mp-group-accordion-item--mine' : '') + '" id="mc-' + D.esc(mc.id) + '">';
        html += '<summary class="mp-group-accordion-header"><div class="mp-group-accordion-title-row">';
        html += '<span class="mp-group-accordion-title">' + D.esc(mc.name) + '</span>';
        if (isMine) html += '<span class="mp-group-mine-badge">My MC</span>';
        html += '<span class="mp-group-accordion-chevron">›</span></div>';
        html += '<div class="mp-group-accordion-bottom"><span class="mp-group-accordion-meta">';
        if (lName) html += '<span class="mp-group-accordion-leader">Leader: ' + D.esc(lName) + '</span>';
        html += '<span class="mp-group-accordion-count">' + mems.length + ' member' + (mems.length !== 1 ? 's' : '') + '</span>';
        html += '</span>';
        var canEditThisMC = _isAdmin || (_isLeader && _ledMCIds.indexOf(mc.id) !== -1);
        if (canEditThisMC) {
          html += '<span class="mp-group-accordion-actions" onclick="event.stopPropagation();">';
          html += '<a href="#" class="mp-btn mp-btn--small mp-btn--outline" onclick="mpMcEdit(\'' + D.esc(mc.id) + '\');event.stopPropagation();return false;">Edit</a>';
          if (_isAdmin) html += '<button class="mp-btn mp-btn--small mp-btn--danger" onclick="mpMcDelete(\'' + D.esc(mc.id) + '\',\'' + D.esc(mc.name) + '\');event.stopPropagation();">Delete</button>';
          html += '</span>';
        }
        html += '</div></summary>';
        html += '<div class="mp-group-accordion-body">';
        if (!mems.length) { html += '<p class="mp-empty" style="margin:12px 0;">No members assigned yet.</p>'; }
        else {
          html += '<ul class="mp-group-dir-list">';
          mems.forEach(function (mm) {
            var prof = profMap[mm.profile_id];
            if (!prof) return;
            var pn = ((prof.first_name || '') + (prof.last_name ? ' ' + prof.last_name : '')).trim() || prof.full_name || prof.email;
            var pinit = D.getInitials(prof);
            html += '<li class="mp-group-dir-row">' + D.renderAvatar(pinit, '', '') + '<div class="mp-group-dir-info">';
            html += '<span class="mp-group-dir-name">' + D.esc(pn) + (mm.is_leader ? ' <span class="mp-group-dir-role">Leader</span>' : '') + '</span>';
            html += '<span class="mp-group-dir-contact"><a href="mailto:' + D.esc(prof.email) + '">' + D.esc(prof.email) + '</a></span>';
            html += '</div></li>';
          });
          html += '</ul>';
        }
        /* ── Post Message panel (visible to leaders of this MC + admin) ── */
        if (canEditThisMC) {
          html += '<div class="mp-post-msg-wrap" style="margin-top:16px;padding-top:16px;border-top:1px solid #e8ecf0;">';
          html += '<details class="mp-admin-panel" id="mc-msg-panel-' + D.esc(mc.id) + '">';
          html += '<summary class="mp-admin-toggle" style="font-size:0.88em;">Post Message to ' + D.esc(mc.name) + ' <span class="mp-admin-badge">Leader</span></summary>';
          html += '<div class="mp-admin-body"><form id="mc-msg-form-' + D.esc(mc.id) + '" data-mc-id="' + D.esc(mc.id) + '" data-mc-name="' + D.esc(mc.name) + '">';
          html += '<div class="mp-form-group"><label>Subject <span class="mp-required">*</span></label><input type="text" name="msg_title" required placeholder="e.g. Meeting this week"></div>';
          html += '<div class="mp-form-group"><label>Message <span class="mp-required">*</span></label><textarea name="msg_body" rows="4" required placeholder="Write your message here…" style="width:100%;padding:9px 12px;border:1px solid var(--mp-border,#dde3eb);border-radius:6px;font-size:0.9em;font-family:inherit;resize:vertical;"></textarea></div>';
          html += '<div class="mp-notify-section"><label class="mp-checkbox-label" style="display:flex;align-items:center;gap:8px;font-size:0.88em;cursor:pointer;"><input type="checkbox" name="send_email" value="1" checked> Notify members by email</label></div>';
          html += '<div style="margin-top:12px;"><button type="submit" class="mp-btn mp-btn--primary mp-btn--small">Post Message</button></div>';
          html += '</form></div></details>';
          html += '</div>';
        }
        html += '</div></details>';
      });
      html += '</div>';
    }

    D.setContent(html);

    /* wire mc post-message forms */
    document.querySelectorAll('[id^="mc-msg-form-"]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var mcId   = form.dataset.mcId;
        var mcName = form.dataset.mcName;
        var title  = (form.querySelector('[name=msg_title]').value || '').trim();
        var body   = (form.querySelector('[name=msg_body]').value  || '').trim();
        var notify = form.querySelector('[name=send_email]') && form.querySelector('[name=send_email]').checked;
        if (!title || !body) { alert('Subject and message are required.'); return; }
        var _sb2 = D.getSb(), uid = D.getUser().id;
        var { data: newMsg, error } = await _sb2.from('admin_messages').insert({
          author_id: uid, title: title, content: body,
          type: 'announcement', target_audience: 'mc', target_mc_id: mcId,
          published_at: new Date().toISOString()
        }).select().single();
        if (error) { alert('Error posting message: ' + error.message); return; }
        if (notify && newMsg) {
          D.callEdge('send-email', {
            action: 'message_notification', title: title, body: body,
            target_type: 'mc', target_id: mcId,
            message_id: newMsg.id
          });
        }
        var panel = document.getElementById('mc-msg-panel-' + mcId);
        if (panel) panel.open = false;
        form.reset();
        alert('Message posted to ' + mcName + (notify ? ' — members will be notified by email.' : '.'));
      });
    });

    /* wire mc form */
    var form = document.getElementById('mc-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var action = fd.get('action_type'), mcId = fd.get('mc_id') || '', name = (fd.get('mc_name') || '').trim(), leaderId = fd.get('leader_id') || null;
        var memberIds = fd.getAll('member_ids');
        if (!name) { alert('MC name is required.'); return; }
        var _sb2 = D.getSb();
        if (action === 'edit' && mcId) {
          await _sb2.from('missional_communities').update({ name, leader_id: leaderId || null }).eq('id', mcId);
          await _sb2.from('mc_members').delete().eq('mc_id', mcId);
        } else {
          var { data: newMc } = await _sb2.from('missional_communities').insert({ name, leader_id: leaderId || null }).select().single();
          mcId = newMc ? newMc.id : null;
        }
        if (mcId && memberIds.length) {
          await _sb2.from('mc_members').insert(memberIds.map(function (pid) { return { mc_id: mcId, profile_id: pid, is_leader: pid === leaderId }; }));
        }
        renderMCsTab();
      });
    }
  }

  window.mpMcEdit = function (id) {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'mcs'); url.searchParams.set('mc_edit', id);
    window.history.pushState({}, '', url.toString());
    renderMCsTab();
  };
  window.mpMcDelete = async function (id, name) {
    if (!confirm('Delete the MC "' + name + '"?')) return;
    var _sb2 = window.mpDashboard.getSb();
    await _sb2.from('mc_members').delete().eq('mc_id', id);
    await _sb2.from('missional_communities').delete().eq('id', id);
    renderMCsTab();
  };

  /* ══════════════════════════════════════════════════════════════
     TAB: TEAMS
     ══════════════════════════════════════════════════════════════ */
  async function renderTeamsTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    var _isLeader = D.isLeader(), _ledTeamIds = D.getLedTeams();
    var _canEdit  = _isAdmin || _isLeader;
    var uid = _profile.id;

    var [teamsRes, memsRes, approvedRes] = await Promise.all([
      _sb.from('teams').select('*').order('name'),
      _sb.from('team_members').select('team_id, member_id, role'),
      _canEdit ? _sb.from('profiles').select('id,first_name,last_name,full_name,email,phone1,phone1_type').eq('status','approved').order('last_name') : Promise.resolve({ data: [] })
    ]);
    var teams    = teamsRes.data || [];
    var tmMems   = memsRes.data || [];
    var approved = approvedRes.data || [];

    var teamMap = {};
    teams.forEach(function (t) { teamMap[t.id] = []; });
    tmMems.forEach(function (tm) { if (teamMap[tm.team_id]) teamMap[tm.team_id].push(tm); });

    var profMap = {};
    approved.forEach(function (p) { profMap[p.id] = p; });

    var editId = new URLSearchParams(window.location.search).get('team_edit') || '';

    var html = '<h2 class="mp-tab-title">Teams</h2>';

    if (_canEdit) {
      var editTeam = editId ? teams.find(function (t) { return t.id === editId; }) : null;
      /* leaders can only edit their own teams */
      if (!_isAdmin && editTeam && _ledTeamIds.indexOf(editTeam.id) === -1) editTeam = null;
      var panelLabel = editTeam ? 'Edit Team: ' + D.esc(editTeam.name) : (_isAdmin ? 'Add New Team' : null);
      if (panelLabel) {
      html += '<details class="mp-admin-panel"' + (editTeam ? ' open' : '') + '>';
      html += '<summary class="mp-admin-toggle">' + panelLabel + ' <span class="mp-admin-badge">' + (_isAdmin ? 'Admin' : 'Leader') + '</span></summary>';
      html += '<div class="mp-admin-body"><form id="team-form">';
      html += '<input type="hidden" name="action_type" value="' + (editTeam ? 'edit' : 'create') + '">';
      if (editTeam) html += '<input type="hidden" name="team_id" value="' + D.esc(editTeam.id) + '">';
      html += '<div class="mp-form-group"><label>Team Name <span class="mp-required">*</span></label><input type="text" name="team_name" value="' + D.esc(editTeam ? editTeam.name : '') + '" required placeholder="e.g. Worship Team"></div>';
      html += '<div class="mp-form-group"><label>Members</label><div class="mp-group-member-picker">';
      var editMemIds = editTeam ? (teamMap[editTeam.id] || []).map(function (tm) { return tm.member_id; }) : [];
      approved.forEach(function (p) {
        var pn = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || p.email;
        html += '<label class="mp-group-member-check"><input type="checkbox" name="member_ids" value="' + D.esc(p.id) + '"' + (editMemIds.indexOf(p.id) !== -1 ? ' checked' : '') + '> ' + D.esc(pn) + '</label>';
      });
      html += '</div></div>';
      html += '<div style="display:flex;gap:10px;margin-top:16px;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">' + (editTeam ? 'Save Changes' : 'Create Team') + '</button>';
      if (editTeam) html += '<a href="#" class="mp-btn mp-btn--secondary" onclick="window.mpDashboard.navigate(\'teams\');return false;">Cancel</a>';
      html += '</div></form></div></details>';
      }
    }

    if (!teams.length) {
      html += '<p class="mp-empty">No teams have been set up yet.</p>';
    } else {
      html += '<div class="mp-group-accordion">';
      teams.forEach(function (team) {
        var mems   = teamMap[team.id] || [];
        var isMine = mems.some(function (tm) { return tm.member_id === uid; });
        html += '<details class="mp-group-accordion-item' + (isMine ? ' mp-group-accordion-item--mine' : '') + '" id="team-' + D.esc(team.id) + '">';
        html += '<summary class="mp-group-accordion-header"><div class="mp-group-accordion-title-row">';
        html += '<span class="mp-group-accordion-title">' + D.esc(team.name) + '</span>';
        if (isMine) html += '<span class="mp-group-mine-badge">My Team</span>';
        html += '<span class="mp-group-accordion-chevron">›</span></div>';
        var canEditThisTeam = _isAdmin || (_isLeader && _ledTeamIds.indexOf(team.id) !== -1);
        html += '<div class="mp-group-accordion-bottom"><span class="mp-group-accordion-meta"><span class="mp-group-accordion-count">' + mems.length + ' member' + (mems.length !== 1 ? 's' : '') + '</span></span>';
        if (canEditThisTeam) {
          html += '<span class="mp-group-accordion-actions" onclick="event.stopPropagation();">';
          html += '<a href="#" class="mp-btn mp-btn--small mp-btn--outline" onclick="mpTeamEdit(\'' + D.esc(team.id) + '\');event.stopPropagation();return false;">Edit</a>';
          if (_isAdmin) html += '<button class="mp-btn mp-btn--small mp-btn--danger" onclick="mpTeamDelete(\'' + D.esc(team.id) + '\',\'' + D.esc(team.name) + '\');event.stopPropagation();">Delete</button>';
          html += '</span>';
        }
        html += '</div></summary>';
        html += '<div class="mp-group-accordion-body">';
        if (!mems.length) { html += '<p class="mp-empty" style="margin:12px 0;">No members assigned yet.</p>'; }
        else {
          html += '<ul class="mp-group-dir-list">';
          mems.forEach(function (tm) {
            var prof = profMap[tm.member_id];
            if (!prof) return;
            var pn = ((prof.first_name || '') + (prof.last_name ? ' ' + prof.last_name : '')).trim() || prof.full_name || prof.email;
            html += '<li class="mp-group-dir-row">' + D.renderAvatar(D.getInitials(prof), '', '') + '<div class="mp-group-dir-info">';
            html += '<span class="mp-group-dir-name">' + D.esc(pn) + '</span>';
            html += '<span class="mp-group-dir-contact"><a href="mailto:' + D.esc(prof.email) + '">' + D.esc(prof.email) + '</a>';
            if (prof.phone1) html += ' <span class="mp-group-dir-sep">·</span> ' + D.esc((prof.phone1_type || 'Cell') + ': ' + prof.phone1);
            html += '</span></div></li>';
          });
          html += '</ul>';
        }
        /* ── Post Message panel (visible to leaders of this team + admin) ── */
        if (canEditThisTeam) {
          html += '<div class="mp-post-msg-wrap" style="margin-top:16px;padding-top:16px;border-top:1px solid #e8ecf0;">';
          html += '<details class="mp-admin-panel" id="team-msg-panel-' + D.esc(team.id) + '">';
          html += '<summary class="mp-admin-toggle" style="font-size:0.88em;">Post Message to ' + D.esc(team.name) + ' <span class="mp-admin-badge">Leader</span></summary>';
          html += '<div class="mp-admin-body"><form id="team-msg-form-' + D.esc(team.id) + '" data-team-id="' + D.esc(team.id) + '" data-team-name="' + D.esc(team.name) + '">';
          html += '<div class="mp-form-group"><label>Subject <span class="mp-required">*</span></label><input type="text" name="msg_title" required placeholder="e.g. Heads up for Sunday"></div>';
          html += '<div class="mp-form-group"><label>Message <span class="mp-required">*</span></label><textarea name="msg_body" rows="4" required placeholder="Write your message here…" style="width:100%;padding:9px 12px;border:1px solid var(--mp-border,#dde3eb);border-radius:6px;font-size:0.9em;font-family:inherit;resize:vertical;"></textarea></div>';
          html += '<div class="mp-notify-section"><label class="mp-checkbox-label" style="display:flex;align-items:center;gap:8px;font-size:0.88em;cursor:pointer;"><input type="checkbox" name="send_email" value="1" checked> Notify members by email</label></div>';
          html += '<div style="margin-top:12px;"><button type="submit" class="mp-btn mp-btn--primary mp-btn--small">Post Message</button></div>';
          html += '</form></div></details>';
          html += '</div>';
        }
        html += '</div></details>';
      });
      html += '</div>';
    }

    D.setContent(html);

    /* wire team post-message forms */
    document.querySelectorAll('[id^="team-msg-form-"]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var teamId   = form.dataset.teamId;
        var teamName = form.dataset.teamName;
        var title    = (form.querySelector('[name=msg_title]').value || '').trim();
        var body     = (form.querySelector('[name=msg_body]').value  || '').trim();
        var notify   = form.querySelector('[name=send_email]') && form.querySelector('[name=send_email]').checked;
        if (!title || !body) { alert('Subject and message are required.'); return; }
        var _sb2 = D.getSb(), uid = D.getUser().id;
        var { data: newMsg, error } = await _sb2.from('admin_messages').insert({
          author_id: uid, title: title, content: body,
          type: 'announcement', target_audience: 'team', target_team_id: teamId,
          published_at: new Date().toISOString()
        }).select().single();
        if (error) { alert('Error posting message: ' + error.message); return; }
        if (notify && newMsg) {
          D.callEdge('send-email', {
            action: 'message_notification', title: title, body: body,
            target_type: 'team', target_id: teamId,
            message_id: newMsg.id
          });
        }
        var panel = document.getElementById('team-msg-panel-' + teamId);
        if (panel) panel.open = false;
        form.reset();
        alert('Message posted to ' + teamName + (notify ? ' — members will be notified by email.' : '.'));
      });
    });

    /* auto-open from hash */
    var hash = window.location.hash;
    if (hash) {
      setTimeout(function () {
        var el = document.querySelector(hash);
        if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }, 80);
    }

    /* wire team form */
    var form = document.getElementById('team-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var action = fd.get('action_type'), teamId = fd.get('team_id') || '', name = (fd.get('team_name') || '').trim();
        var memberIds = fd.getAll('member_ids');
        if (!name) { alert('Team name is required.'); return; }
        var _sb2 = D.getSb();
        if (action === 'edit' && teamId) {
          await _sb2.from('teams').update({ name }).eq('id', teamId);
          await _sb2.from('team_members').delete().eq('team_id', teamId);
        } else {
          var { data: newT, error: newTErr } = await _sb2.from('teams').insert({ name }).select().single();
          if (newTErr) { alert('Error creating team: ' + newTErr.message); return; }
          teamId = newT ? newT.id : null;
        }
        if (teamId && memberIds.length) {
          await _sb2.from('team_members').insert(memberIds.map(function (pid) { return { team_id: teamId, member_id: pid, role: 'member' }; }));
        }
        await renderTeamsTab();
      });
    }
  }

  window.mpTeamEdit = function (id) {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'teams'); url.searchParams.set('team_edit', id);
    window.history.pushState({}, '', url.toString());
    renderTeamsTab();
  };
  window.mpTeamDelete = async function (id, name) {
    if (!confirm('Delete the team "' + name + '"?')) return;
    var _sb2 = window.mpDashboard.getSb();
    await _sb2.from('team_members').delete().eq('team_id', id);
    await _sb2.from('teams').delete().eq('id', id);
    renderTeamsTab();
  };

})();
