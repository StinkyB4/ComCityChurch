/**
 * COMMISSIONED CITY CHURCH — SUNDAY MASTER SCHEDULE
 * Grid view of all Sunday gathering role assignments.
 * Rows = roles (Preacher → Greeters), Columns = Sundays.
 * Data source: schedule_rosters (type='sunday').
 */
(function () {
  'use strict';

  /* ── wait for core module then register ─────────────────────── */
  var _waited = 0;
  function tryRegister() {
    if (window.mpDashboard) window.mpDashboard.render_master = renderMasterTab;
    else if (_waited++ < 60) setTimeout(tryRegister, 100);
  }
  tryRegister();

  /* ── role definitions (matches OVC Schedule.xlsx row order) ─── */
  var MASTER_ROLES = [
    { key: 'Preacher',          label: 'Preacher'            },
    { key: 'Setup',             label: 'Setup'               },
    { key: 'Bread',             label: 'Bread'               },
    { key: 'Music Leader',      label: 'Music Leader'        },
    { key: 'Musicians/Singers', label: 'Musicians / Singers' },
    { key: 'Sound',             label: 'Sound'               },
    { key: 'Slides',            label: 'Slides'              },
    { key: 'Lock Up',           label: 'Lock Up'             },
    { key: 'Greeters',          label: 'Greeters'            }
  ];

  var ROLE_KEYWORDS = {
    'Preacher':          ['preacher'],
    'Setup':             ['setup'],
    'Bread':             ['bread', 'communion'],
    'Music Leader':      ['music leader'],
    'Musicians/Singers': ['musician', 'singer'],
    'Sound':             ['sound'],
    'Slides':            ['slide'],
    'Lock Up':           ['lock'],
    'Greeters':          ['greet']
  };

  /* ── module state ───────────────────────────────────────────── */
  var _sb, _uid, _canEdit;
  var _rosters   = [];
  var _sundays   = [];
  var _profMap   = {};
  var _guestMap  = {};
  var _childMap  = {};
  var _assigneeOpts = '';

  /* ── helpers ─────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function matchRole(slotRole) {
    var r = (slotRole || '').toLowerCase();
    for (var key in ROLE_KEYWORDS) {
      if (ROLE_KEYWORDS[key].some(function (kw) { return r.indexOf(kw) !== -1; })) return key;
    }
    return null;
  }

  function getSlotsForRole(roster, roleKey) {
    return (roster && roster.slots ? roster.slots : []).filter(function (s) {
      return matchRole(s.role) === roleKey;
    });
  }

  function rosterForDate(date) {
    return _rosters.find(function (r) { return r.date === date; }) || null;
  }

  function resolveSlotName(slot) {
    if (!slot || !slot.assignee_type) return '';
    var t = slot.assignee_type;
    if (t === 'guest_inline') return slot.guest_name || '';
    if (t === 'child') {
      var ch = _childMap[slot.assignee_id]; return ch ? ch.name : '';
    }
    if (t === 'member' && slot.assignee_id) {
      var p = _profMap[slot.assignee_id];
      return p ? (((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || '') : '';
    }
    if (t === 'couple' && slot.assignee_id) {
      var pa = _profMap[slot.assignee_id], pb = slot.assignee_id_b ? _profMap[slot.assignee_id_b] : null;
      if (pa && pb) return window.mpDashboard.coupleDisplayName(pa, pb);
      return pa ? (pa.first_name || pa.full_name || '') : '';
    }
    if (t === 'guest' && slot.guest_id) {
      var g = _guestMap[slot.guest_id]; return g ? g.name : '';
    }
    return '';
  }

  function computeSundays(pastWeeks, futureWeeks) {
    var sundays = [];
    var now = new Date();
    var dow = now.getDay();
    var thisSun = new Date(now); thisSun.setDate(now.getDate() - dow); thisSun.setHours(0, 0, 0, 0);
    var start = new Date(thisSun); start.setDate(start.getDate() - pastWeeks * 7);
    for (var i = 0; i <= pastWeeks + futureWeeks; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i * 7);
      sundays.push(d.toISOString().split('T')[0]);
    }
    return sundays;
  }

  function buildAssigneeOpts() {
    var html = '<option value="">— Select person —</option>';
    var memberOpts = '', coupleOpts = '', seenCouples = {};
    Object.values(_profMap).sort(function (a, b) {
      return ((a.last_name || '') + (a.first_name || '')).localeCompare((b.last_name || '') + (b.first_name || ''));
    }).forEach(function (p) {
      if (p.spouse_id && _profMap[p.spouse_id]) {
        var k = [p.id, p.spouse_id].sort().join('_');
        if (!seenCouples[k]) {
          seenCouples[k] = true;
          var sp = _profMap[p.spouse_id];
          var label = window.mpDashboard.coupleDisplayName(p, sp);
          coupleOpts += '<option value="couple:' + p.id + ':' + p.spouse_id + '">' + esc(label) + '</option>';
        }
      }
      var mn = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || '';
      memberOpts += '<option value="member:' + p.id + '">' + esc(mn) + '</option>';
    });
    if (memberOpts) html += '<optgroup label="Members">'   + memberOpts + '</optgroup>';
    if (coupleOpts) html += '<optgroup label="Couples / Families">' + coupleOpts + '</optgroup>';
    return html;
  }

  /* ── CSS injection ───────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('mp-master-css')) return;
    var s = document.createElement('style'); s.id = 'mp-master-css';
    s.textContent = [
      /* Scrollable wrapper */
      '.mp-master-outer{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #dde3eb;border-radius:8px;margin-top:4px;}',
      /* Table base */
      '.mp-master-tbl{border-collapse:collapse;width:max-content;min-width:100%;font-size:0.83rem;background:#fff;}',
      '.mp-master-tbl th,.mp-master-tbl td{border:1px solid #e5e7eb;padding:0;vertical-align:middle;}',
      /* Sticky role column */
      '.mp-master-lbl{position:sticky;left:0;z-index:2;background:#f7f9fc;min-width:138px;width:138px;max-width:138px;padding:7px 10px;font-weight:600;font-size:0.81rem;color:#374151;white-space:nowrap;border-right:2px solid #dde3eb !important;}',
      '.mp-master-hd-lbl{position:sticky;left:0;z-index:3;background:#f7f9fc;min-width:138px;width:138px;max-width:138px;padding:8px 10px;font-weight:700;font-size:0.76rem;text-transform:uppercase;letter-spacing:.04em;color:#5C718E;border-right:2px solid #dde3eb !important;}',
      /* Date header cells */
      '.mp-master-hd{min-width:108px;width:108px;max-width:108px;text-align:center;padding:6px 4px;background:#f7f9fc;}',
      '.mp-master-hd-date{font-weight:700;font-size:0.85rem;color:#112E53;display:block;line-height:1.2;}',
      '.mp-master-hd-dow{font-size:0.7rem;color:#9ca3af;display:block;margin-bottom:4px;}',
      '.mp-master-hd.mp-ms-today{background:#e5ecf8 !important;}',
      '.mp-master-hd.mp-ms-today .mp-master-hd-date{color:#112E53;}',
      '.mp-master-hd.mp-ms-past{background:#f9fafb;}',
      '.mp-master-hd.mp-ms-past .mp-master-hd-date{color:#9ca3af;}',
      '.mp-master-hd.mp-ms-cancelled{background:#f3f4f6;}',
      '.mp-master-hd.mp-ms-cancelled .mp-master-hd-date{color:#d1d5db;text-decoration:line-through;}',
      '.mp-ms-no-gather{font-size:0.7rem;color:#9ca3af;font-style:italic;display:block;margin:2px 0;}',
      /* Action buttons in header */
      '.mp-ms-cancel-btn{font-size:0.68rem;padding:1px 5px;cursor:pointer;background:none;border:1px solid #fca5a5;border-radius:3px;color:#dc2626;line-height:1.5;margin-top:2px;}',
      '.mp-ms-cancel-btn:hover{background:#fef2f2;}',
      '.mp-ms-restore-btn{font-size:0.68rem;padding:1px 5px;cursor:pointer;background:none;border:1px solid #6ee7b7;border-radius:3px;color:#059669;line-height:1.5;margin-top:2px;}',
      '.mp-ms-restore-btn:hover{background:#ecfdf5;}',
      /* Data cells */
      '.mp-master-cell{min-width:108px;width:108px;max-width:108px;padding:6px 7px;text-align:center;line-height:1.4;}',
      '.mp-master-cell.mp-ms-editable{cursor:pointer;}',
      '.mp-master-cell.mp-ms-editable:hover{background:#f0f4f8;}',
      '.mp-master-cell.mp-ms-cancelled{background:#f9fafb;pointer-events:none;}',
      '.mp-master-cell.mp-ms-past{background:#fafafa;}',
      '.mp-ms-name{font-size:0.81rem;color:#222;display:block;}',
      '.mp-ms-name.mp-ms-me{font-weight:700;color:#112E53;}',
      '.mp-ms-tbd{font-size:0.78rem;color:#d1d5db;font-style:italic;}',
      '.mp-ms-empty{font-size:0.75rem;color:#e5e7eb;}',
      /* Row group separators */
      '.mp-ms-group-sep td{border-top:2px solid #dde3eb !important;}',
      /* Today column highlight */
      '.mp-ms-today-cell{background:#f5f8ff !important;}',
      /* Assignment modal */
      '.mp-ms-modal-ov{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:8500;display:flex;align-items:center;justify-content:center;}',
      '.mp-ms-modal{background:#fff;border-radius:10px;padding:22px;width:min(380px,92vw);max-height:82vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.18);}',
      '.mp-ms-modal-title{font-weight:700;font-size:0.98rem;color:#112E53;margin:0 0 4px;}',
      '.mp-ms-modal-sub{font-size:0.8rem;color:#9ca3af;margin:0 0 14px;}',
      '.mp-ms-slot-list{list-style:none;margin:0 0 8px;padding:0;}',
      '.mp-ms-slot-li{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;}',
      '.mp-ms-slot-li:last-child{border-bottom:none;}',
      '.mp-ms-slot-name{flex:1;font-size:0.86rem;color:#222;}',
      '.mp-ms-slot-rm{background:none;border:none;color:#dc2626;cursor:pointer;padding:2px 6px;border-radius:3px;font-size:1rem;line-height:1;}',
      '.mp-ms-slot-rm:hover{background:#fef2f2;}',
      '.mp-ms-add-row{display:flex;gap:7px;margin-top:6px;align-items:center;}',
      '.mp-ms-add-sel{flex:1;min-width:0;}',
      '.mp-ms-modal-ft{display:flex;gap:8px;margin-top:14px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── auto-generate missing Sunday rosters ────────────────────── */
  async function autoGenSundays(sundays, templateSlots) {
    var existingDates = {};
    _rosters.forEach(function (r) { existingDates[r.date] = true; });
    var missing = sundays.filter(function (d) { return !existingDates[d]; });
    if (!missing.length) return;

    /* build default empty slots */
    var defaultSlots = [];
    if (templateSlots && templateSlots.length) {
      templateSlots.forEach(function (ts) {
        for (var i = 0; i < (ts.count || 1); i++) {
          defaultSlots.push({ id: 'slot_' + Math.random().toString(36).slice(2), role: ts.role, assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' });
        }
      });
    } else {
      MASTER_ROLES.forEach(function (r) {
        defaultSlots.push({ id: 'slot_' + Math.random().toString(36).slice(2), role: r.key, assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' });
      });
    }

    /* insert in batches */
    var toInsert = missing.map(function (date) {
      return { date: date, title: 'Sunday Gathering', type: 'sunday', slots: JSON.parse(JSON.stringify(defaultSlots)), cancelled: false };
    });
    for (var i = 0; i < toInsert.length; i += 20) {
      var batch = toInsert.slice(i, i + 20);
      var res = await _sb.from('schedule_rosters').insert(batch);
      if (res.error) console.warn('Master schedule auto-gen:', res.error.message);
    }
    toInsert.forEach(function (r) { _rosters.push(r); });
    _rosters.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  /* ── main render ─────────────────────────────────────────────── */
  async function renderMasterTab() {
    var D = window.mpDashboard;
    _sb = D.getSb();
    var profile = D.getProfile();
    _uid = profile.id;
    _canEdit = D.isAdmin() || D.isLeader();

    D.showLoading();
    injectCSS();

    _sundays = computeSundays(4, 52);
    var rangeStart = _sundays[0];
    var rangeEnd   = _sundays[_sundays.length - 1];

    /* parallel fetches */
    var [rRes, pRes, gRes, cRes, tRes] = await Promise.all([
      _sb.from('schedule_rosters').select('*').gte('date', rangeStart).lte('date', rangeEnd).eq('type', 'sunday').order('date'),
      _sb.from('profiles').select('id,first_name,last_name,full_name,spouse_id').eq('status', 'approved'),
      _sb.from('guests').select('*'),
      _sb.from('children').select('id,name,profile_id'),
      _sb.from('schedule_templates').select('*').eq('is_default', true).limit(1)
    ]);

    _rosters  = rRes.data || [];
    _profMap  = {}; _guestMap = {}; _childMap = {};
    (pRes.data || []).forEach(function (p) { _profMap[p.id]  = p; });
    (gRes.data || []).forEach(function (g) { _guestMap[g.id] = g; });
    (cRes.data || []).forEach(function (c) { _childMap[c.id] = c; });
    _assigneeOpts = buildAssigneeOpts();

    /* auto-generate missing Sunday rosters for admins/leaders */
    if (_canEdit) {
      var defTpl = (tRes.data || [])[0];
      await autoGenSundays(_sundays, defTpl ? (defTpl.slots || []) : []);
    }

    renderGrid();
  }

  /* ── grid renderer ───────────────────────────────────────────── */
  function renderGrid() {
    var todayStr = new Date().toISOString().split('T')[0];
    var dow = new Date().getDay();
    var thisSun = new Date(); thisSun.setDate(new Date().getDate() - dow);
    var thisSunStr = thisSun.toISOString().split('T')[0];
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var html = '<h2 class="mp-tab-title">Sunday Master Schedule</h2>';
    html += '<p style="font-size:0.83rem;color:#9ca3af;margin:0 0 12px;">10:30 AM – 12:00 PM &nbsp;·&nbsp; Scroll right for upcoming Sundays</p>';

    if (_canEdit) {
      html += '<p style="font-size:0.8rem;color:#5C718E;margin:0 0 10px;">Click any cell to assign someone to that role.</p>';
    }

    html += '<div class="mp-master-outer"><table class="mp-master-tbl"><thead><tr>';
    html += '<th class="mp-master-hd-lbl">Role</th>';

    _sundays.forEach(function (date) {
      var roster    = rosterForDate(date);
      var cancelled = roster && roster.cancelled;
      var isToday   = date === thisSunStr;
      var isPast    = date < todayStr;
      var d   = new Date(date + 'T12:00:00');
      var lbl = MONTHS[d.getMonth()] + ' ' + d.getDate();
      var cls = 'mp-master-hd';
      if (cancelled)    cls += ' mp-ms-cancelled';
      else if (isToday) cls += ' mp-ms-today';
      else if (isPast)  cls += ' mp-ms-past';
      html += '<th class="' + cls + '" data-date="' + esc(date) + '">';
      html += '<span class="mp-master-hd-dow">Sunday</span>';
      html += '<span class="mp-master-hd-date">' + esc(lbl) + '</span>';
      if (cancelled) {
        html += '<span class="mp-ms-no-gather">No Gathering</span>';
        if (_canEdit) html += '<button class="mp-ms-restore-btn" onclick="mpMasterRestoreSunday(\'' + esc(date) + '\')">Restore</button>';
      } else if (_canEdit && !isPast) {
        html += '<button class="mp-ms-cancel-btn" onclick="mpMasterCancelSunday(\'' + esc(date) + '\')">Cancel</button>';
      }
      html += '</th>';
    });
    html += '</tr></thead><tbody>';

    /* group separators after rows 0,3 (before Music Leader and Sound sections) */
    var GROUP_BREAKS = { 3: true, 5: true }; /* after Bread, after Musicians */

    MASTER_ROLES.forEach(function (role, ri) {
      var rowCls = GROUP_BREAKS[ri] ? 'mp-ms-group-sep' : '';
      html += '<tr class="' + rowCls + '">';
      html += '<td class="mp-master-lbl">' + esc(role.label) + '</td>';

      _sundays.forEach(function (date) {
        var roster    = rosterForDate(date);
        var cancelled = roster && roster.cancelled;
        var isPast    = date < todayStr;
        var isToday   = date === thisSunStr;
        var slots     = getSlotsForRole(roster, role.key);

        var cellCls = 'mp-master-cell';
        if (cancelled)        cellCls += ' mp-ms-cancelled';
        else if (_canEdit)    cellCls += ' mp-ms-editable';
        if (isPast && !isToday) cellCls += ' mp-ms-past';
        if (isToday && !cancelled) cellCls += ' mp-ms-today-cell';

        var inner = '';
        if (cancelled) {
          inner = '<span class="mp-ms-empty">—</span>';
        } else if (!roster || !slots.length) {
          inner = '<span class="mp-ms-tbd">TBD</span>';
        } else {
          var filled = slots.filter(function (s) { return s.assignee_type && s.assignee_id; });
          if (!filled.length) {
            inner = '<span class="mp-ms-tbd">TBD</span>';
          } else {
            inner = filled.map(function (s) {
              var name = resolveSlotName(s);
              if (!name) return '<span class="mp-ms-tbd">TBD</span>';
              var isMe = (s.assignee_type === 'member' && s.assignee_id === _uid) ||
                         (s.assignee_type === 'couple' && (s.assignee_id === _uid || s.assignee_id_b === _uid));
              return '<span class="mp-ms-name' + (isMe ? ' mp-ms-me' : '') + '">' + esc(name) + '</span>';
            }).join('');
          }
        }

        var clickAttr = '';
        if (_canEdit && !cancelled) {
          clickAttr = ' onclick="mpMasterEditCell(\'' + esc(date) + '\',\'' + esc(role.key) + '\')"';
          clickAttr += ' title="Assign ' + esc(role.label) + '"';
        }
        html += '<td class="' + cellCls + '"' + clickAttr + '>' + inner + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    /* legend */
    html += '<div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:0.77rem;color:#9ca3af;">';
    if (_canEdit) html += '<span><span style="color:#5b21b6;">&#9632;</span> Click to assign</span>';
    html += '<span><strong style="color:#112E53;">Bold</strong> = You</span>';
    html += '<span><span style="color:#d1d5db;">TBD</span> = Slot exists, unassigned</span>';
    html += '</div>';

    window.mpDashboard.setContent(html);

    /* scroll to this Sunday */
    requestAnimationFrame(function () {
      var outer  = document.querySelector('.mp-master-outer');
      var todayTh = document.querySelector('.mp-master-hd.mp-ms-today');
      if (outer && todayTh) outer.scrollLeft = Math.max(0, todayTh.offsetLeft - 160);
    });
  }

  /* ── cancel / restore Sunday ─────────────────────────────────── */
  window.mpMasterCancelSunday = async function (date) {
    var d  = new Date(date + 'T12:00:00');
    var dl = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!confirm('Cancel the Sunday Gathering on ' + dl + '?\nIt will appear as "No Gathering" on the calendar.')) return;
    var roster = rosterForDate(date);
    var res;
    if (roster) {
      res = await _sb.from('schedule_rosters').update({ cancelled: true }).eq('date', date);
      if (!res.error) roster.cancelled = true;
    } else {
      res = await _sb.from('schedule_rosters').insert({ date: date, title: 'Sunday Gathering', type: 'sunday', slots: [], cancelled: true });
      if (!res.error) _rosters.push({ date: date, title: 'Sunday Gathering', type: 'sunday', slots: [], cancelled: true });
    }
    if (res.error) { alert('Error: ' + res.error.message); return; }
    renderGrid();
  };

  window.mpMasterRestoreSunday = async function (date) {
    var res = await _sb.from('schedule_rosters').update({ cancelled: false }).eq('date', date);
    if (res.error) { alert('Error: ' + res.error.message); return; }
    var roster = rosterForDate(date);
    if (roster) roster.cancelled = false;
    renderGrid();
  };

  /* ── cell assignment modal ───────────────────────────────────── */
  window.mpMasterEditCell = function (date, roleKey) {
    var existing = document.getElementById('mp-ms-modal-ov');
    if (existing) existing.remove();

    var roleObj = MASTER_ROLES.find(function (r) { return r.key === roleKey; });
    var roster  = rosterForDate(date);
    var slots   = getSlotsForRole(roster, roleKey);
    var d       = new Date(date + 'T12:00:00');
    var dateLbl = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    window._mpMsEditSlots = slots.map(function (s) { return Object.assign({}, s); });
    window._mpMsEditDate  = date;
    window._mpMsEditRole  = roleKey;

    var html = '<div class="mp-ms-modal-ov" id="mp-ms-modal-ov" onclick="if(event.target===this)mpMasterCloseModal()">';
    html += '<div class="mp-ms-modal">';
    html += '<div class="mp-ms-modal-title">' + esc(roleObj ? roleObj.label : roleKey) + '</div>';
    html += '<div class="mp-ms-modal-sub">' + esc(dateLbl) + '</div>';

    html += buildSlotListHtml(slots);

    html += '<div class="mp-ms-add-row">';
    html += '<select class="mp-ms-add-sel" id="mp-ms-add-sel">' + _assigneeOpts + '</select>';
    html += '<button class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpMasterAddSlot()">+ Add</button>';
    html += '</div>';

    html += '<div class="mp-ms-modal-ft">';
    html += '<button class="mp-btn mp-btn--primary" style="flex:1;" onclick="mpMasterSaveCell(\'' + esc(date) + '\',\'' + esc(roleKey) + '\')">Save</button>';
    html += '<button class="mp-btn mp-btn--secondary" onclick="mpMasterCloseModal()">Cancel</button>';
    html += '</div></div></div>';

    var el = document.createElement('div'); el.innerHTML = html;
    document.body.appendChild(el.firstChild);
  };

  function buildSlotListHtml(slots) {
    var html = '<ul class="mp-ms-slot-list" id="mp-ms-slot-list">';
    var filled = slots.filter(function (s) { return s.assignee_type && s.assignee_id; });
    if (!filled.length) {
      html += '<li style="color:#9ca3af;font-size:0.84rem;font-style:italic;padding:6px 0;">No one assigned yet.</li>';
    } else {
      filled.forEach(function (slot) {
        var name = resolveSlotName(slot) || '(unknown)';
        html += '<li class="mp-ms-slot-li" data-slot-id="' + esc(slot.id) + '">';
        html += '<span class="mp-ms-slot-name">' + esc(name) + '</span>';
        html += '<button class="mp-ms-slot-rm" onclick="mpMasterRemoveSlot(this)" title="Remove">&#10005;</button>';
        html += '</li>';
      });
    }
    html += '</ul>';
    return html;
  }

  window.mpMasterCloseModal = function () {
    var el = document.getElementById('mp-ms-modal-ov');
    if (el) el.remove();
    window._mpMsEditSlots = null;
  };

  window.mpMasterRemoveSlot = function (btn) {
    var li     = btn.closest('.mp-ms-slot-li');
    var slotId = li ? li.dataset.slotId : null;
    if (slotId) {
      window._mpMsEditSlots = (window._mpMsEditSlots || []).filter(function (s) { return s.id !== slotId; });
    }
    if (li) li.remove();
    var list = document.getElementById('mp-ms-slot-list');
    if (list && !list.querySelector('.mp-ms-slot-li')) {
      list.innerHTML = '<li style="color:#9ca3af;font-size:0.84rem;font-style:italic;padding:6px 0;">No one assigned yet.</li>';
    }
  };

  window.mpMasterAddSlot = function () {
    var sel = document.getElementById('mp-ms-add-sel');
    if (!sel || !sel.value) return;
    var combined = sel.value;
    var pts = combined.split(':');
    var aType = pts[0], aId = pts[1] || '', aIdB = pts[2] || '';

    /* prevent duplicate */
    var already = (window._mpMsEditSlots || []).some(function (s) {
      return s.assignee_type === aType && s.assignee_id === aId;
    });
    if (already) return;

    var newSlot = { id: 'slot_' + Math.random().toString(36).slice(2), role: window._mpMsEditRole || '', assignee_type: aType, assignee_id: aId, assignee_id_b: aIdB, guest_id: '' };
    (window._mpMsEditSlots = window._mpMsEditSlots || []).push(newSlot);

    var name = resolveSlotName(newSlot) || sel.options[sel.selectedIndex].text;
    var list = document.getElementById('mp-ms-slot-list');
    /* remove empty placeholder */
    var placeholder = list ? list.querySelector('li:not(.mp-ms-slot-li)') : null;
    if (placeholder) placeholder.remove();
    if (list) {
      var li = document.createElement('li');
      li.className = 'mp-ms-slot-li';
      li.dataset.slotId = newSlot.id;
      li.innerHTML = '<span class="mp-ms-slot-name">' + esc(name) + '</span>'
        + '<button class="mp-ms-slot-rm" onclick="mpMasterRemoveSlot(this)" title="Remove">&#10005;</button>';
      list.appendChild(li);
    }
    sel.value = '';
  };

  window.mpMasterSaveCell = async function (date, roleKey) {
    var roster       = rosterForDate(date);
    var newRoleSlots = (window._mpMsEditSlots || []).map(function (s) {
      return Object.assign({}, s, { role: roleKey });
    });
    var otherSlots = (roster ? roster.slots || [] : []).filter(function (s) {
      return matchRole(s.role) !== roleKey;
    });
    var merged = otherSlots.concat(newRoleSlots);

    var res;
    if (roster) {
      res = await _sb.from('schedule_rosters').update({ slots: merged }).eq('date', date);
      if (!res.error) roster.slots = merged;
    } else {
      var payload = { date: date, title: 'Sunday Gathering', type: 'sunday', slots: merged, cancelled: false };
      res = await _sb.from('schedule_rosters').insert(payload);
      if (!res.error) _rosters.push(payload);
    }
    if (res.error) { alert('Save failed: ' + res.error.message); return; }
    mpMasterCloseModal();
    renderGrid();
  };

})();
