/**
 * COMMISSIONED CITY CHURCH — SUNDAY MASTER SCHEDULE
 * Rows = Sunday-serving teams  ·  Columns = Sundays
 *
 * Fixes in this version:
 *   • Upsert (not insert/update) so re-renders never erase data
 *   • Save auto-adds the dropdown selection before writing (no "Add first" needed)
 *   • Children + non-members assignable per team setting
 *   • Zoom controls
 *   • Fills entire right-hand panel
 *   • Two-way sync: calendar day-click shows Sunday roster from the same table
 */
(function () {
  'use strict';

  /* ── registration ──────────────────────────────────────────────── */
  var _w = 0;
  function tryRegister() {
    if (window.mpDashboard) window.mpDashboard.render_master = renderMasterTab;
    else if (_w++ < 80) setTimeout(tryRegister, 100);
  }
  tryRegister();

  /* ── module state ──────────────────────────────────────────────── */
  var _sb, _uid, _canEdit;
  var _rosters    = [];   // schedule_rosters rows (type='sunday')
  var _sundays    = [];   // ['2026-05-03', ...]
  var _teams      = [];   // teams with is_sunday_serving=true
  var _tmMap      = {};   // team_id → [member_id, ...]
  var _profMap    = {};
  var _guestMap   = {};
  var _childMap   = {};
  var _zoom       = 100;  // 60–150 %
  var _curTeam    = null; // team being edited in modal
  var _curDate    = '';
  var _editSlots  = [];   // working slot list in modal

  /* ── pure helpers ──────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function rosterFor(date) {
    return _rosters.find(function (r) { return r.date === date; }) || null;
  }

  function slotsForTeam(roster, team) {
    if (!roster) return [];
    var tid = team.id, tname = (team.name || '').toLowerCase();
    return (roster.slots || []).filter(function (s) {
      return s.team_id ? s.team_id === tid : (s.role || '').toLowerCase() === tname;
    });
  }

  function resolveName(slot) {
    if (!slot || !slot.assignee_type) return '';
    var t = slot.assignee_type;
    if (t === 'guest_inline') return slot.guest_name || '';
    if (t === 'child') { var ch = _childMap[slot.assignee_id]; return ch ? ch.name : (slot.child_name || ''); }
    if ((t === 'member' || t === 'couple') && slot.assignee_id) {
      var p = _profMap[slot.assignee_id];
      if (!p) return '';
      if (t === 'member') return ((p.first_name||'')+(p.last_name?' '+p.last_name:'')).trim()||p.full_name||'';
      var pb = slot.assignee_id_b ? _profMap[slot.assignee_id_b] : null;
      return (p && pb) ? window.mpDashboard.coupleDisplayName(p, pb) : (p.first_name||p.full_name||'');
    }
    return '';
  }

  function computeSundays(pastWeeks, futureWeeks) {
    var list = [];
    var now = new Date(), dow = now.getDay();
    var thisSun = new Date(now); thisSun.setDate(now.getDate() - dow); thisSun.setHours(0,0,0,0);
    var start = new Date(thisSun); start.setDate(start.getDate() - pastWeeks * 7);
    for (var i = 0; i <= pastWeeks + futureWeeks; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i * 7);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }

  /* ── team-specific assignee dropdown ──────────────────────────── */
  function buildTeamOpts(team) {
    var memberIds = _tmMap[team.id] || [];
    var html = '<option value="">— Select person —</option>';
    var mOpts = '', cOpts = '', seen = {};
    memberIds.forEach(function (pid) {
      var p = _profMap[pid]; if (!p) return;
      if (p.spouse_id && _profMap[p.spouse_id] && memberIds.indexOf(p.spouse_id) !== -1) {
        var k = [p.id, p.spouse_id].sort().join('_');
        if (!seen[k]) {
          seen[k] = true;
          cOpts += '<option value="couple:' + p.id + ':' + p.spouse_id + '">' + esc(window.mpDashboard.coupleDisplayName(p, _profMap[p.spouse_id])) + '</option>';
        }
      }
      var mn = ((p.first_name||'')+(p.last_name?' '+p.last_name:'')).trim()||p.full_name||'';
      mOpts += '<option value="member:' + p.id + '">' + esc(mn) + '</option>';
    });
    if (mOpts) html += '<optgroup label="Members">'         + mOpts + '</optgroup>';
    if (cOpts) html += '<optgroup label="Couples / Families">' + cOpts + '</optgroup>';
    if (team.allow_children) {
      var kids = Object.values(_childMap).sort(function (a,b) { return a.name.localeCompare(b.name); }).map(function (c) {
        var par = _profMap[c.profile_id];
        var pn  = par ? (((par.first_name||'')+(par.last_name?' '+par.last_name:'')).trim()||par.full_name||'') : '';
        return '<option value="child:' + c.id + '">' + esc(c.name+(pn?' ('+pn+')':'')) + '</option>';
      }).join('');
      if (kids) html += '<optgroup label="Children">' + kids + '</optgroup>';
    }
    if (team.allow_nonmembers) {
      html += '<option value="guest_inline">✚ Non-member (enter name &amp; email)</option>';
    }
    return html;
  }

  /* ── CSS injection ─────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('mp-master-css')) return;
    var s = document.createElement('style'); s.id = 'mp-master-css';
    s.textContent = [
      '.mp-master-wrap{display:flex;flex-direction:column;height:calc(100vh - 72px);max-height:calc(100vh - 72px);}',
      '.mp-master-bar{display:flex;align-items:center;gap:10px;padding:0 0 10px;flex-shrink:0;flex-wrap:wrap;}',
      '.mp-master-outer{flex:1;overflow:auto;border:1px solid #dde3eb;border-radius:8px;min-height:0;}',
      /* zoom */
      '.mp-ms-zoom{display:flex;align-items:center;gap:5px;margin-left:auto;}',
      '.mp-ms-zbtn{background:#fff;border:1px solid #dde3eb;border-radius:4px;width:26px;height:26px;cursor:pointer;font-size:1.05rem;color:#555;display:flex;align-items:center;justify-content:center;}',
      '.mp-ms-zbtn:hover{background:#f0f4f8;}',
      '.mp-ms-zlbl{font-size:0.79rem;color:#555;min-width:36px;text-align:center;}',
      /* table */
      '.mp-master-tbl{border-collapse:collapse;width:max-content;min-width:100%;background:#fff;}',
      '.mp-master-tbl th,.mp-master-tbl td{border:1px solid #e5e7eb;}',
      /* sticky label col */
      '.mp-ms-lbl{position:sticky;left:0;z-index:2;background:#f7f9fc;min-width:130px;width:130px;padding:7px 10px;font-weight:600;font-size:0.81rem;color:#374151;white-space:nowrap;border-right:2px solid #dde3eb!important;}',
      '.mp-ms-hd-lbl{position:sticky;left:0;z-index:3;background:#f7f9fc;min-width:130px;width:130px;padding:8px 10px;font-weight:700;font-size:0.74rem;text-transform:uppercase;letter-spacing:.04em;color:#5C718E;border-right:2px solid #dde3eb!important;}',
      /* date headers */
      '.mp-ms-hd{min-width:100px;width:100px;text-align:center;padding:5px 4px;background:#f7f9fc;vertical-align:middle;}',
      '.mp-ms-hd-date{font-weight:700;font-size:0.84rem;color:#112E53;display:block;line-height:1.2;}',
      '.mp-ms-hd-dow{font-size:0.68rem;color:#9ca3af;display:block;margin-bottom:2px;}',
      '.mp-ms-hd.mp-ms-today{background:#e5ecf8!important;}',
      '.mp-ms-hd.mp-ms-next{background:#ede9fe!important;border-bottom:3px solid #7c3aed;}',
      '.mp-ms-cell.mp-ms-next-c{background:#faf5ff!important;}',
      '.mp-ms-hd.mp-ms-past{background:#f9fafb;} .mp-ms-hd.mp-ms-past .mp-ms-hd-date{color:#9ca3af;}',
      '.mp-ms-hd.mp-ms-canc{background:#f3f4f6;} .mp-ms-hd.mp-ms-canc .mp-ms-hd-date{color:#d1d5db;text-decoration:line-through;}',
      '.mp-ms-no-g{font-size:0.68rem;color:#9ca3af;font-style:italic;display:block;margin:2px 0 1px;}',
      '.mp-ms-hd-acts{display:flex;gap:3px;justify-content:center;margin-top:3px;}',
      '.mp-ms-cx-btn{font-size:0.66rem;padding:1px 5px;cursor:pointer;background:none;border:1px solid #fca5a5;border-radius:3px;color:#dc2626;line-height:1.5;}',
      '.mp-ms-cx-btn:hover{background:#fef2f2;}',
      '.mp-ms-rv-btn{font-size:0.66rem;padding:1px 5px;cursor:pointer;background:none;border:1px solid #6ee7b7;border-radius:3px;color:#059669;line-height:1.5;}',
      '.mp-ms-rv-btn:hover{background:#ecfdf5;}',
      /* data cells */
      '.mp-ms-cell{min-width:100px;width:100px;padding:5px 6px;text-align:center;vertical-align:middle;}',
      '.mp-ms-cell.mp-ms-ed:hover{background:#f0f4f8;cursor:pointer;}',
      '.mp-ms-cell.mp-ms-canc-c{background:#f9fafb;}',
      '.mp-ms-cell.mp-ms-past-c{background:#fafafa;}',
      '.mp-ms-cell.mp-ms-today-c{background:#f5f8ff!important;}',
      '.mp-ms-name{font-size:0.81rem;color:#222;display:block;line-height:1.35;}',
      '.mp-ms-name.mp-ms-me{font-weight:700;color:#112E53;}',
      '.mp-ms-tbd{font-size:0.76rem;color:#d1d5db;font-style:italic;}',
      /* row separators between teams */
      '.mp-ms-sep td{border-top:2px solid #dde3eb!important;}',
      /* modal */
      '.mp-ms-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:8500;display:flex;align-items:center;justify-content:center;}',
      '.mp-ms-box{background:#fff;border-radius:10px;padding:22px;width:min(410px,92vw);max-height:82vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.18);}',
      '.mp-ms-box-title{font-weight:700;font-size:0.97rem;color:#112E53;margin:0 0 2px;}',
      '.mp-ms-box-sub{font-size:0.79rem;color:#9ca3af;margin:0 0 12px;}',
      '.mp-ms-list{list-style:none;margin:0 0 8px;padding:0;}',
      '.mp-ms-li{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;}',
      '.mp-ms-li:last-child{border-bottom:none;}',
      '.mp-ms-li-name{flex:1;font-size:0.85rem;color:#222;}',
      '.mp-ms-li-rm{background:none;border:none;color:#dc2626;cursor:pointer;padding:2px 6px;border-radius:3px;font-size:1rem;line-height:1;}',
      '.mp-ms-li-rm:hover{background:#fef2f2;}',
      '.mp-ms-add{display:flex;flex-direction:column;gap:6px;margin-top:8px;}',
      '.mp-ms-add select{width:100%;}',
      '.mp-ms-guest-f{display:none;flex-direction:column;gap:5px;}',
      '.mp-ms-guest-f input{width:100%;font-size:0.84rem;box-sizing:border-box;}',
      '.mp-ms-add-row{display:flex;gap:7px;align-items:center;}',
      '.mp-ms-ft{display:flex;gap:8px;margin-top:14px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── auto-generate missing Sunday rosters via upsert ──────────── */
  async function autoGen() {
    var existing = {};
    _rosters.forEach(function (r) { existing[r.date] = true; });
    var missing = _sundays.filter(function (d) { return !existing[d]; });
    if (!missing.length) return;

    /* one default slot per team */
    var defSlots = _teams.map(function (t) {
      return { id: 'slot_' + Math.random().toString(36).slice(2), role: t.name, team_id: t.id, assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' };
    });
    var rows = missing.map(function (date) {
      return { date: date, title: 'Sunday Gathering', type: 'sunday', slots: JSON.parse(JSON.stringify(defSlots)) };
    });
    for (var i = 0; i < rows.length; i += 20) {
      var batch = rows.slice(i, i + 20);
      var res = await _sb.from('schedule_rosters').upsert(batch, { onConflict: 'date' });
      if (res.error) { console.warn('Master auto-gen:', res.error.message); }
      else { batch.forEach(function (r) { if (!existing[r.date]) { _rosters.push(r); existing[r.date] = true; } }); }
    }
    _rosters.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  /* ── main render ───────────────────────────────────────────────── */
  async function renderMasterTab() {
    var D = window.mpDashboard;
    _sb = D.getSb(); _uid = D.getProfile().id;
    _canEdit = D.isAdmin() || D.isLeader();
    D.showLoading(); injectCSS();

    _sundays = computeSundays(4, 52);
    var rs = _sundays[0], re = _sundays[_sundays.length - 1];

    var [rRes, tRes, tmRes, pRes, gRes, cRes, defTplRes] = await Promise.all([
      _sb.from('schedule_rosters').select('*').gte('date', rs).lte('date', re).eq('type', 'sunday').order('date'),
      _sb.from('teams').select('*').eq('is_sunday_serving', true).order('serving_order').order('name'),
      _sb.from('team_members').select('team_id,member_id'),
      _sb.from('profiles').select('id,first_name,last_name,full_name,spouse_id').eq('status', 'approved'),
      _sb.from('guests').select('*'),
      _sb.from('children').select('id,name,profile_id').order('name'),
      _sb.from('schedule_templates').select('*').eq('is_default', true).limit(1)
    ]);

    _rosters = rRes.data || []; _teams = tRes.data || [];
    _profMap = {}; _guestMap = {}; _childMap = {}; _tmMap = {};
    (pRes.data || []).forEach(function (p) { _profMap[p.id]  = p; });
    (gRes.data || []).forEach(function (g) { _guestMap[g.id] = g; });
    (cRes.data || []).forEach(function (c) { _childMap[c.id] = c; });
    _teams.forEach(function (t) { _tmMap[t.id] = []; });
    (tmRes.data || []).forEach(function (tm) { if (_tmMap[tm.team_id]) _tmMap[tm.team_id].push(tm.member_id); });

    /* ── auto-create Sunday serving teams from default template if none exist ── */
    var defTpl = (defTplRes.data || [])[0];
    if (_canEdit && _teams.length === 0 && defTpl && (defTpl.slots || []).length) {
      var toCreate = defTpl.slots.map(function (s, i) {
        return { name: s.role, is_sunday_serving: true, allow_children: false, allow_nonmembers: false, serving_order: i * 10 };
      });
      var autoTRes = await _sb.from('teams').insert(toCreate).select();
      if (!autoTRes.error && autoTRes.data) {
        _teams = autoTRes.data;
        _teams.forEach(function (t) { _tmMap[t.id] = []; });
      }
    }

    if (_canEdit && _teams.length) await autoGen();
    renderGrid();
  }

  /* ── grid ──────────────────────────────────────────────────────── */
  function renderGrid() {
    var todayStr = new Date().toISOString().split('T')[0];
    var now = new Date(); var dow = now.getDay();
    var thisSun = new Date(now); thisSun.setDate(now.getDate() - dow);
    var thisSunStr = thisSun.toISOString().split('T')[0];
    /* next upcoming (non-cancelled) Sunday gathering to highlight */
    var upcomingSunStr = '';
    for (var si = 0; si < _sundays.length; si++) {
      if (_sundays[si] >= todayStr) {
        var rsi = rosterFor(_sundays[si]);
        if (!rsi || !rsi.cancelled) { upcomingSunStr = _sundays[si]; break; }
      }
    }
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var cw = Math.round(100 * _zoom / 100);  /* cell width */
    var fs = (_zoom / 100 * 0.83).toFixed(3) + 'rem';

    if (!_teams.length) {
      window.mpDashboard.setContent(
        '<h2 class="mp-tab-title">Sunday Master Schedule</h2>' +
        '<p class="mp-empty" style="margin-top:20px;">No Sunday serving teams configured yet.</p>' +
        (_canEdit ? '<p style="font-size:0.85rem;color:#5C718E;">Go to <strong>Teams</strong>, create or edit a team, and check <em>"Sunday serving team"</em>.</p>' : '')
      );
      return;
    }

    var html = '<div class="mp-master-wrap">';

    /* toolbar */
    html += '<div class="mp-master-bar">';
    html += '<h2 class="mp-tab-title" style="margin:0;">Sunday Master Schedule</h2>';
    html += '<span style="font-size:0.79rem;color:#9ca3af;">10:30 AM – 12:00 PM</span>';
    if (_canEdit) html += '<span style="font-size:0.79rem;color:#5C718E;">Click a cell to assign</span>';
    html += '<div class="mp-ms-zoom">';
    html += '<button class="mp-ms-zbtn" onclick="mpMasterZoom(-10)">−</button>';
    html += '<span class="mp-ms-zlbl" id="ms-zlbl">' + _zoom + '%</span>';
    html += '<button class="mp-ms-zbtn" onclick="mpMasterZoom(10)">+</button>';
    html += '</div></div>';

    /* scroll container */
    html += '<div class="mp-master-outer" id="ms-outer">';
    html += '<table class="mp-master-tbl" id="ms-tbl" style="font-size:' + fs + ';">';

    /* ── thead ── */
    html += '<thead><tr><th class="mp-ms-hd-lbl">Team / Role</th>';
    _sundays.forEach(function (date) {
      var r = rosterFor(date), canc = r && r.cancelled;
      var isToday = date === thisSunStr, isPast = date < todayStr;
      var d = new Date(date + 'T12:00:00');
      var lbl = MON[d.getMonth()] + ' ' + d.getDate();
      var cls = 'mp-ms-hd';
      if (canc) cls += ' mp-ms-canc'; else if (isToday) cls += ' mp-ms-today'; else if (isPast) cls += ' mp-ms-past';
      if (date === upcomingSunStr && !canc) cls += ' mp-ms-next';
      html += '<th class="' + cls + '" style="min-width:' + cw + 'px;width:' + cw + 'px;">';
      html += '<span class="mp-ms-hd-dow">Sunday</span>';
      html += '<span class="mp-ms-hd-date">' + esc(lbl) + '</span>';
      if (canc) html += '<span class="mp-ms-no-g">No Gathering</span>';
      if (_canEdit) {
        html += '<div class="mp-ms-hd-acts">';
        if (canc) html += '<button class="mp-ms-rv-btn" onclick="mpMasterRestore(\'' + esc(date) + '\')">Restore</button>';
        else if (!isPast) html += '<button class="mp-ms-cx-btn" onclick="mpMasterCancel(\'' + esc(date) + '\')">Cancel</button>';
        html += '</div>';
      }
      html += '</th>';
    });
    html += '</tr></thead>';

    /* ── tbody ── */
    html += '<tbody>';
    _teams.forEach(function (team, ti) {
      html += '<tr' + (ti > 0 ? ' class="mp-ms-sep"' : '') + '>';
      html += '<td class="mp-ms-lbl" title="' + esc(team.name) + '">' + esc(team.name) + '</td>';
      _sundays.forEach(function (date) {
        var r = rosterFor(date), canc = r && r.cancelled;
        var isPast = date < todayStr, isToday = date === thisSunStr;
        var slots  = slotsForTeam(r, team);
        var cCls   = 'mp-ms-cell';
        if (canc) cCls += ' mp-ms-canc-c';
        else if (_canEdit) cCls += ' mp-ms-ed';
        if (isPast && !isToday) cCls += ' mp-ms-past-c';
        if (isToday && !canc)   cCls += ' mp-ms-today-c';
        if (date === upcomingSunStr && !canc) cCls += ' mp-ms-next-c';
        var inner = '';
        if (canc) {
          inner = '<span style="color:#e9e9e9;">—</span>';
        } else {
          var filled = slots.filter(function (s) { return s.assignee_type && (s.assignee_id || s.guest_name); });
          if (!filled.length) {
            inner = '<span class="mp-ms-tbd">TBD</span>';
          } else {
            inner = filled.map(function (s) {
              var name = resolveName(s);
              if (!name) return '<span class="mp-ms-tbd">TBD</span>';
              var isMe = (s.assignee_type==='member'&&s.assignee_id===_uid)||(s.assignee_type==='couple'&&(s.assignee_id===_uid||s.assignee_id_b===_uid));
              return '<span class="mp-ms-name' + (isMe?' mp-ms-me':'') + '">' + esc(name) + '</span>';
            }).join('');
          }
        }
        var onCk = (_canEdit && !canc)
          ? ' onclick="mpMasterEdit(\'' + esc(date) + '\',\'' + esc(team.id) + '\')" title="Assign ' + esc(team.name) + '"'
          : '';
        html += '<td class="' + cCls + '" style="min-width:' + cw + 'px;width:' + cw + 'px;"' + onCk + '>' + inner + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    window.mpDashboard.setContent(html);

    /* auto-scroll to the next upcoming Sunday */
    requestAnimationFrame(function () {
      var outer = document.getElementById('ms-outer');
      var th    = document.querySelector('.mp-ms-hd.mp-ms-next') || document.querySelector('.mp-ms-hd.mp-ms-today');
      if (outer && th) outer.scrollLeft = Math.max(0, th.offsetLeft - 148);
    });
  }

  /* ── zoom ──────────────────────────────────────────────────────── */
  window.mpMasterZoom = function (delta) {
    _zoom = Math.min(160, Math.max(55, _zoom + delta));
    var lbl = document.getElementById('ms-zlbl');
    if (lbl) lbl.textContent = _zoom + '%';
    var fs  = (_zoom / 100 * 0.83).toFixed(3) + 'rem';
    var cw  = Math.round(100 * _zoom / 100);
    var tbl = document.getElementById('ms-tbl');
    if (tbl) tbl.style.fontSize = fs;
    document.querySelectorAll('.mp-ms-hd,.mp-ms-cell').forEach(function (el) {
      el.style.minWidth = cw + 'px'; el.style.width = cw + 'px';
    });
  };

  /* ── cancel / restore ──────────────────────────────────────────── */
  window.mpMasterCancel = async function (date) {
    var d = new Date(date + 'T12:00:00');
    var dl = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!confirm('Cancel the Sunday Gathering on ' + dl + '?\nIt will show as "No Gathering" on the calendar.')) return;
    var r = rosterFor(date);
    var res = await _sb.from('schedule_rosters').upsert(
      { date: date, title: 'Sunday Gathering', type: 'sunday', cancelled: true, slots: r ? (r.slots || []) : [] },
      { onConflict: 'date' }
    );
    if (res.error) { alert('Error: ' + res.error.message); return; }
    if (r) r.cancelled = true;
    else _rosters.push({ date: date, title: 'Sunday Gathering', type: 'sunday', slots: [], cancelled: true });
    renderGrid();
  };

  window.mpMasterRestore = async function (date) {
    var res = await _sb.from('schedule_rosters').update({ cancelled: false }).eq('date', date);
    if (res.error) { alert('Error: ' + res.error.message); return; }
    var r = rosterFor(date); if (r) r.cancelled = false;
    renderGrid();
  };

  /* ── cell editor modal ─────────────────────────────────────────── */
  window.mpMasterEdit = function (date, teamId) {
    var existing = document.getElementById('mp-ms-ov'); if (existing) existing.remove();
    var team = _teams.find(function (t) { return t.id === teamId; }); if (!team) return;
    _curTeam  = team; _curDate = date;
    var r     = rosterFor(date);
    _editSlots = slotsForTeam(r, team).map(function (s) { return Object.assign({}, s); });
    var d    = new Date(date + 'T12:00:00');
    var dl   = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var opts = buildTeamOpts(team);

    var html = '<div class="mp-ms-ov" id="mp-ms-ov" onclick="if(event.target===this)mpMasterClose()">'
      + '<div class="mp-ms-box">'
      + '<div class="mp-ms-box-title">' + esc(team.name) + '</div>'
      + '<div class="mp-ms-box-sub">' + esc(dl) + '</div>'
      + buildListHtml(_editSlots)
      + '<div class="mp-ms-add">'
      + '<select class="mp-ms-add-sel" id="mp-ms-sel" onchange="mpMasterSelChg(this.value)">' + opts + '</select>'
      + '<div class="mp-ms-guest-f" id="mp-ms-gf">'
      + '<input type="text"  id="mp-ms-gname"  placeholder="Full name (required)">'
      + '<input type="email" id="mp-ms-gemail" placeholder="Email address (optional)">'
      + '</div>'
      + '<div class="mp-ms-add-row"><button class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpMasterAdd()">+ Add</button></div>'
      + '</div>'
      + '<div class="mp-ms-ft">'
      + '<button class="mp-btn mp-btn--primary" style="flex:1;" onclick="mpMasterSave(\'' + esc(date) + '\',\'' + esc(teamId) + '\')">Save</button>'
      + '<button class="mp-btn mp-btn--secondary" onclick="mpMasterClose()">Cancel</button>'
      + '</div></div></div>';

    var el = document.createElement('div'); el.innerHTML = html;
    document.body.appendChild(el.firstChild);
  };

  function buildListHtml(slots) {
    var filled = (slots || []).filter(function (s) { return s.assignee_type && (s.assignee_id || s.guest_name); });
    var html = '<ul class="mp-ms-list" id="mp-ms-list">';
    if (!filled.length) {
      html += '<li id="mp-ms-empty" style="color:#9ca3af;font-size:0.84rem;font-style:italic;padding:6px 0;">No one assigned yet.</li>';
    } else {
      filled.forEach(function (s) {
        html += '<li class="mp-ms-li" data-sid="' + esc(s.id) + '">'
          + '<span class="mp-ms-li-name">' + esc(resolveName(s) || s.guest_name || '(unknown)') + '</span>'
          + '<button class="mp-ms-li-rm" onclick="mpMasterRm(this)" title="Remove">&#10005;</button>'
          + '</li>';
      });
    }
    return html + '</ul>';
  }

  window.mpMasterSelChg = function (val) {
    var gf = document.getElementById('mp-ms-gf');
    if (gf) gf.style.display = val === 'guest_inline' ? 'flex' : 'none';
  };

  window.mpMasterClose = function () {
    var el = document.getElementById('mp-ms-ov'); if (el) el.remove();
    _editSlots = []; _curTeam = null; _curDate = '';
  };

  window.mpMasterRm = function (btn) {
    var li = btn.closest('.mp-ms-li');
    var sid = li ? li.dataset.sid : null;
    if (sid) _editSlots = _editSlots.filter(function (s) { return s.id !== sid; });
    if (li) li.remove();
    var list = document.getElementById('mp-ms-list');
    if (list && !list.querySelector('.mp-ms-li')) {
      var e = document.createElement('li'); e.id = 'mp-ms-empty';
      e.style.cssText = 'color:#9ca3af;font-size:0.84rem;font-style:italic;padding:6px 0;';
      e.textContent = 'No one assigned yet.'; list.appendChild(e);
    }
  };

  window.mpMasterAdd = function () {
    var sel = document.getElementById('mp-ms-sel');
    var val = sel ? sel.value : ''; if (!val) return;
    var slot;
    if (val === 'guest_inline') {
      var gn = (document.getElementById('mp-ms-gname')  || {}).value || '';
      var ge = (document.getElementById('mp-ms-gemail') || {}).value || '';
      if (!gn.trim()) { var ni = document.getElementById('mp-ms-gname'); if (ni) ni.focus(); return; }
      slot = { id: 'slot_'+Math.random().toString(36).slice(2), role: _curTeam?_curTeam.name:'', team_id: _curTeam?_curTeam.id:'', assignee_type:'guest_inline', assignee_id:'', assignee_id_b:'', guest_id:'', guest_name:gn.trim(), guest_email:ge.trim() };
      var gni = document.getElementById('mp-ms-gname'), gei = document.getElementById('mp-ms-gemail');
      if (gni) gni.value = ''; if (gei) gei.value = '';
      var gf = document.getElementById('mp-ms-gf'); if (gf) gf.style.display = 'none';
    } else {
      var pts = val.split(':');
      if (_editSlots.some(function(s) { return s.assignee_type===pts[0]&&s.assignee_id===pts[1]; })) { sel.value=''; return; }
      slot = { id: 'slot_'+Math.random().toString(36).slice(2), role: _curTeam?_curTeam.name:'', team_id: _curTeam?_curTeam.id:'', assignee_type:pts[0]||'', assignee_id:pts[1]||'', assignee_id_b:pts[2]||'', guest_id:'', guest_name:'', guest_email:'' };
      if (pts[0]==='child'&&pts[1]&&_childMap[pts[1]]) slot.child_name = _childMap[pts[1]].name;
    }
    _editSlots.push(slot); sel.value = '';
    var empty = document.getElementById('mp-ms-empty'); if (empty) empty.remove();
    var list  = document.getElementById('mp-ms-list');
    if (list) {
      var li = document.createElement('li'); li.className='mp-ms-li'; li.dataset.sid=slot.id;
      li.innerHTML='<span class="mp-ms-li-name">'+esc(resolveName(slot)||slot.guest_name||'')+'</span>'
        +'<button class="mp-ms-li-rm" onclick="mpMasterRm(this)" title="Remove">&#10005;</button>';
      list.appendChild(li);
    }
  };

  window.mpMasterSave = async function (date, teamId) {
    /* if someone is selected but not yet added, add them first */
    var sel = document.getElementById('mp-ms-sel');
    if (sel && sel.value) mpMasterAdd();

    var team = _teams.find(function (t) { return t.id === teamId; });
    var r    = rosterFor(date);
    var tname = (team ? team.name : '').toLowerCase();
    /* keep slots from other teams untouched */
    var others = (r ? r.slots || [] : []).filter(function (s) {
      return s.team_id ? s.team_id !== teamId : (s.role||'').toLowerCase() !== tname;
    });
    var merged = others.concat(_editSlots);
    var payload = { date: date, title: 'Sunday Gathering', type: 'sunday', slots: merged };
    if (r && r.cancelled !== undefined) payload.cancelled = r.cancelled;

    var res = await _sb.from('schedule_rosters').upsert(payload, { onConflict: 'date' });
    if (res.error) { alert('Save failed: ' + res.error.message); return; }

    if (r) { r.slots = merged; }
    else   { _rosters.push(Object.assign({ cancelled: false }, payload)); _rosters.sort(function(a,b){return a.date.localeCompare(b.date);}); }

    mpMasterClose(); renderGrid();
  };

})();
