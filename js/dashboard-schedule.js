/**
 * DASHBOARD MODULE — Part C: Schedule tab
 * Requires dashboard.js to be loaded first.
 */
(function () {
  'use strict';

  var MAX_WAIT = 60, waited = 0;
  function tryRegister() {
    if (window.mpDashboard) { register(); }
    else if (waited < MAX_WAIT) { waited++; setTimeout(tryRegister, 100); }
  }
  function register() { window.mpDashboard.render_schedule = renderScheduleTab; }
  tryRegister();

  /* ── calendar state ──────────────────────────────────────────── */
  var _now = new Date();
  var _calState = { year: _now.getFullYear(), month: _now.getMonth() };

  /* inject calendar CSS once */
  (function injectCalCSS() {
    if (document.getElementById('mp-cal-css')) return;
    var s = document.createElement('style');
    s.id = 'mp-cal-css';
    s.textContent = [
      '.mp-cal-section{background:#fff;border-radius:8px;padding:20px;margin-bottom:24px;box-shadow:0 2px 10px rgba(0,0,0,0.07);}',
      '.mp-cal-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;}',
      '.mp-cal-month-title{font-weight:700;font-size:1.05rem;flex:1;text-align:center;color:#222;}',
      '.mp-cal-nav-btn{background:none;border:1px solid #dde3eb;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:1rem;color:#555;transition:background .15s;}',
      '.mp-cal-nav-btn:hover{background:#f0f4f8;}',
      '.mp-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}',
      '.mp-cal-dow{text-align:center;font-size:0.72rem;font-weight:700;color:#999;padding:4px 0;letter-spacing:.04em;text-transform:uppercase;}',
      '.mp-cal-day{min-height:68px;padding:4px 5px;border-radius:5px;cursor:pointer;background:#f7f9fc;transition:background .12s;border:1px solid transparent;}',
      '.mp-cal-day:hover{background:#eef2f8;border-color:#dde3eb;}',
      '.mp-cal-day--today{background:#e5ecf8 !important;border-color:#112E53 !important;}',
      '.mp-cal-day--other{opacity:.35;pointer-events:none;}',
      '.mp-cal-day--selected{border-color:#112E53 !important;background:#dce7f7 !important;}',
      '.mp-cal-day-num{font-size:0.78rem;font-weight:700;color:#555;display:block;margin-bottom:3px;}',
      '.mp-cal-day--today .mp-cal-day-num{color:#112E53;}',
      '.mp-cal-chip{font-size:0.68rem;padding:1px 5px;border-radius:3px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}',
      '.mp-cal-chip--all{background:#dce7f7;color:#112E53;}',
      '.mp-cal-chip--team{background:#fef3c7;color:#78350f;}',
      '.mp-cal-chip--mc{background:#d1fae5;color:#065f46;}',
      '.mp-cal-chip--serving{background:#112E53;color:#fff;}',
      '.mp-cal-detail{background:#f0f4f8;border-radius:6px;padding:16px;margin-top:12px;border-left:3px solid #112E53;}',
      '.mp-cal-detail-title{font-weight:700;font-size:0.95rem;margin:0 0 10px;color:#112E53;}',
      '.mp-cal-detail-event{background:#fff;border-radius:5px;padding:10px 12px;margin-bottom:8px;border:1px solid #dde3eb;}',
      '.mp-cal-detail-event-title{font-weight:600;font-size:0.9rem;color:#222;}',
      '.mp-cal-detail-event-meta{font-size:0.8rem;color:#777;margin-top:2px;}',
      '.mp-cal-detail-event-desc{font-size:0.85rem;color:#444;margin-top:6px;}',
      '.mp-cal-detail-serving{background:#112E53;color:#fff;border-radius:5px;padding:10px 12px;margin-bottom:8px;font-size:0.88rem;}',
      '.mp-cal-add-btn{margin-left:auto;white-space:nowrap;}',
      '.mp-event-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;}',
      '.mp-event-modal{background:#fff;border-radius:10px;padding:24px;width:min(480px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.18);}',
      '.mp-event-modal-title{font-weight:700;font-size:1.1rem;margin:0 0 18px;color:#112E53;}',
      '.mp-event-modal-footer{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}',
      '@media(max-width:540px){.mp-cal-day{min-height:48px;}.mp-cal-chip{display:none;}.mp-cal-day--has-event::after{content:"•";display:block;text-align:center;font-size:0.9rem;color:#112E53;}.mp-cal-day--serving::after{content:"•";display:block;text-align:center;font-size:0.9rem;color:#112E53;}}',
      '.mp-cal-export-row{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}',
      '.mp-cal-export-label{font-size:0.77rem;color:#aaa;white-space:nowrap;}',
      '.mp-cal-export-btn{display:inline-flex;align-items:center;gap:4px;font-size:0.77rem;padding:3px 9px;border-radius:4px;text-decoration:none;border:1px solid #dde3eb;cursor:pointer;font-family:inherit;background:#fff;color:#555;line-height:1.5;transition:border-color .12s,color .12s;}',
      '.mp-cal-export-btn:hover{border-color:#112E53;color:#112E53;}',
      '.mp-cal-detail-serving .mp-cal-export-label{color:rgba(255,255,255,0.65);}',
      '.mp-cal-detail-serving .mp-cal-export-btn{border-color:rgba(255,255,255,0.35);color:rgba(255,255,255,0.9);background:rgba(255,255,255,0.12);}',
      '.mp-cal-detail-serving .mp-cal-export-btn:hover{background:rgba(255,255,255,0.25);border-color:#fff;color:#fff;}',
      '.mp-tpl-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px;}',
      '.mp-tpl-card{background:#f7f9fc;border:1px solid #dde3eb;border-radius:6px;overflow:hidden;}',
      '.mp-tpl-card-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #eef2f8;}',
      '.mp-tpl-card-name{font-weight:700;font-size:0.88rem;color:#222;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.mp-tpl-card-actions{display:flex;gap:5px;flex-shrink:0;}',
      '.mp-tpl-slots{padding:8px 12px;}',
      '.mp-tpl-slot-row{display:flex;align-items:center;justify-content:space-between;padding:3px 0;font-size:0.82rem;color:#444;border-bottom:1px solid #f0f4f8;}',
      '.mp-tpl-slot-row:last-child{border-bottom:none;}',
      '.mp-tpl-slot-count{background:#e5ecf8;color:#112E53;border-radius:3px;padding:1px 6px;font-size:0.75rem;font-weight:700;white-space:nowrap;}',
      '.mp-tpl-role-row{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:7px 10px;background:#f7f9fc;border:1px solid #e8ecf2;border-radius:5px;}',
      '.mp-tpl-role-input{flex:1;min-width:0;}',
      '.mp-tpl-count-wrap{display:flex;align-items:center;gap:4px;flex-shrink:0;}',
      '.mp-tpl-count-label{font-size:0.78rem;color:#888;}',
      '.mp-tpl-count-input{width:52px;text-align:center;}',
      '.mp-tpl-order-btns{display:flex;flex-direction:column;gap:2px;flex-shrink:0;}',
      '.mp-tpl-order-btn{background:none;border:1px solid #dde3eb;border-radius:3px;padding:0 5px;cursor:pointer;font-size:0.78rem;line-height:1.6;color:#555;transition:background .1s;}',
      '.mp-tpl-order-btn:hover{background:#eef2f8;}',
      '.mp-tpl-load-bar{display:flex;align-items:center;gap:8px;background:#f0f4f8;border-radius:6px;padding:9px 12px;margin-bottom:4px;}',
      '.mp-tpl-load-label{font-size:0.83rem;color:#555;white-space:nowrap;font-weight:600;}',
      '.mp-tpl-load-select{flex:1;min-width:0;}'
    ].join('');
    document.head.appendChild(s);
  })();

  /* ── schedule helpers ────────────────────────────────────────── */
  function nextSunday() {
    var now = new Date(), dow = now.getDay();
    var days = (dow === 0 && now.getHours() >= 12) ? 7 : ((7 - dow) % 7 === 0 ? 0 : (7 - dow) % 7);
    var d = new Date(now); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  function fmtShort(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function assigneeName(slot, profMap, guestMap) {
    var t = slot.assignee_type || '';
    if (t === 'member' && slot.assignee_id) {
      var p = profMap[slot.assignee_id];
      return p ? (((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || '') : '';
    }
    if (t === 'couple' && slot.assignee_id) {
      var a = profMap[slot.assignee_id], b = slot.assignee_id_b ? profMap[slot.assignee_id_b] : null;
      if (a && b) return window.mpDashboard.coupleDisplayName(a, b);
      return a ? (a.first_name || a.full_name || '') : '';
    }
    if (t === 'guest' && slot.guest_id) {
      var g = guestMap[slot.guest_id];
      return g ? g.name : '';
    }
    return '';
  }
  function buildAssigneeOptions(profMap, guestMap) {
    var D = window.mpDashboard;
    var html = '<option value="">— Unassigned —</option>';
    var memberOpts = '', coupleOpts = '', seenCouples = {};
    Object.values(profMap).sort(function (a, b) {
      return ((a.first_name || '') + (a.last_name || '')).localeCompare((b.first_name || '') + (b.last_name || ''));
    }).forEach(function (p) {
      if (p.spouse_id && profMap[p.spouse_id]) {
        var k = [p.id, p.spouse_id].sort().join('_');
        if (!seenCouples[k]) {
          seenCouples[k] = true;
          var sp = profMap[p.spouse_id];
          var label = D.coupleDisplayName(p, sp);
          coupleOpts += '<option value="couple:' + D.esc(p.id) + ':' + D.esc(p.spouse_id) + '">' + D.esc(label) + '</option>';
        }
      }
      var mn = ((p.first_name || '') + (p.last_name ? ' ' + p.last_name : '')).trim() || p.full_name || p.email;
      memberOpts += '<option value="member:' + D.esc(p.id) + '">' + D.esc(mn) + '</option>';
    });
    if (memberOpts) html += '<optgroup label="Members">' + memberOpts + '</optgroup>';
    if (coupleOpts) html += '<optgroup label="Couples / Families">' + coupleOpts + '</optgroup>';
    var guestOpts = Object.values(guestMap).map(function (g) {
      return '<option value="guest:' + D.esc(g.id) + '">' + D.esc(g.name + ' (guest)') + '</option>';
    }).join('');
    if (guestOpts) html += '<optgroup label="Non-Member Volunteers">' + guestOpts + '</optgroup>';
    return html;
  }

  /* ── calendar renderer ───────────────────────────────────────── */
  function renderCalendarSection(year, month, rosters, calEvents, uid, canManage, D, teams, mcs) {
    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var todayStr = new Date().toISOString().split('T')[0];

    /* build lookup: date → {events, serving} */
    var dayData = {};
    calEvents.forEach(function (ev) {
      if (!dayData[ev.event_date]) dayData[ev.event_date] = { events: [], serving: false };
      dayData[ev.event_date].events.push(ev);
    });
    rosters.forEach(function (r) {
      if (!dayData[r.date]) dayData[r.date] = { events: [], serving: false };
      var slots = r.slots || [];
      if (slots.some(function (s) { return (s.assignee_type === 'member' && s.assignee_id === uid) || (s.assignee_type === 'couple' && (s.assignee_id === uid || s.assignee_id_b === uid)); })) {
        dayData[r.date].serving = true;
      }
    });

    /* calendar grid math */
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevMonthDays = new Date(year, month, 0).getDate();

    var html = '<div class="mp-cal-section">';

    /* header */
    html += '<div class="mp-cal-header">';
    html += '<button class="mp-cal-nav-btn" onclick="mpCalPrev()">&#8592;</button>';
    html += '<span class="mp-cal-month-title">' + MONTH_NAMES[month] + ' ' + year + '</span>';
    html += '<button class="mp-cal-nav-btn" onclick="mpCalNext()">&#8594;</button>';
    if (canManage) {
      html += '<button class="mp-btn mp-btn--primary mp-btn--small mp-cal-add-btn" onclick="mpCalAddEvent()">+ Add Event</button>';
    }
    html += '</div>';

    /* day-of-week headers */
    html += '<div class="mp-cal-grid">';
    DOW.forEach(function (d) { html += '<div class="mp-cal-dow">' + d + '</div>'; });

    /* leading blanks (prev month) */
    for (var pi = 0; pi < firstDay; pi++) {
      var pDay = prevMonthDays - firstDay + pi + 1;
      html += '<div class="mp-cal-day mp-cal-day--other"><span class="mp-cal-day-num">' + pDay + '</span></div>';
    }

    /* current month days */
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var isToday = dateStr === todayStr;
      var data = dayData[dateStr] || { events: [], serving: false };
      var cls = 'mp-cal-day';
      if (isToday) cls += ' mp-cal-day--today';
      if (data.events.length) cls += ' mp-cal-day--has-event';
      if (data.serving) cls += ' mp-cal-day--serving';

      html += '<div class="' + cls + '" data-date="' + dateStr + '" onclick="mpCalDayClick(\'' + dateStr + '\')">';
      html += '<span class="mp-cal-day-num">' + day + '</span>';
      if (data.serving) {
        html += '<span class="mp-cal-chip mp-cal-chip--serving">Serving</span>';
      }
      data.events.slice(0, 2).forEach(function (ev) {
        var chipCls = 'mp-cal-chip mp-cal-chip--' + (ev.visibility || 'all');
        html += '<span class="' + chipCls + '">' + D.esc(ev.title) + '</span>';
      });
      if (data.events.length > 2) {
        html += '<span class="mp-cal-chip" style="color:#999;">+' + (data.events.length - 2) + ' more</span>';
      }
      html += '</div>';
    }

    /* trailing blanks */
    var totalCells = firstDay + daysInMonth;
    var trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var ti = 1; ti <= trailing; ti++) {
      html += '<div class="mp-cal-day mp-cal-day--other"><span class="mp-cal-day-num">' + ti + '</span></div>';
    }

    html += '</div>'; /* grid */
    html += '<div id="mp-cal-detail" style="display:none;"></div>';
    html += '</div>'; /* section */

    return html;
  }

  /* ── main renderer ───────────────────────────────────────────── */
  async function renderScheduleTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    var _isLeader = D.isLeader();
    if (_isLeader) _isAdmin = true;
    var uid = _profile.id;
    var qs = new URLSearchParams(window.location.search);
    var editDate = qs.get('sched_edit') || '';
    var creating = _isAdmin && qs.has('sched_new');

    /* parallel fetch — rosters (last 7 days onward) + calendar events */
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    var cutoffStr = cutoff.toISOString().split('T')[0];

    var calYear = _calState.year, calMonth = _calState.month;
    var monthStart = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-01';
    var nextMonthYear = calMonth === 11 ? calYear + 1 : calYear;
    var nextMonthNum  = calMonth === 11 ? 1 : calMonth + 2;
    var nextMonthStart = nextMonthYear + '-' + String(nextMonthNum).padStart(2, '0') + '-01';

    var fetches = [
      _sb.from('schedule_rosters').select('*').gte('date', cutoffStr).order('date'),
      _sb.from('schedule_templates').select('*').order('is_default', { ascending: false }),
      _sb.from('guests').select('*').order('name'),
      _sb.from('profiles').select('id,first_name,last_name,full_name,email,phone1,phone1_type,spouse_id').eq('status', 'approved'),
      _sb.from('events').select('*').gte('event_date', monthStart).lt('event_date', nextMonthStart).order('event_date')
    ];
    if (_isAdmin) {
      fetches.push(_sb.from('teams').select('id,name').order('name'));
      fetches.push(_sb.from('missional_communities').select('id,name').order('name'));
    }

    var results = await Promise.all(fetches);
    var rosters   = results[0].data || [];
    var templates = results[1].data || [];
    var guests    = results[2].data || [];
    var approved  = results[3].data || [];
    var calEvents = results[4].data || [];
    var teams     = _isAdmin ? (results[5].data || []) : [];
    var mcs       = _isAdmin ? (results[6].data || []) : [];

    var profMap = {}, guestMap = {};
    approved.forEach(function (p) { profMap[p.id] = p; });
    guests.forEach(function (g) { guestMap[g.id] = g; });

    var todayStr = new Date().toISOString().split('T')[0];
    var nextSun  = nextSunday();

    /* store for calendar click handler */
    window._mpCalData = { calEvents: calEvents, rosters: rosters, uid: uid, D: D, canManage: _isAdmin, teams: teams, mcs: mcs, sb: _sb };

    var html = '<h2 class="mp-tab-title">Schedule</h2>';

    if (qs.get('sched_saved')) html += D.alertHtml('Schedule saved.', 'success');
    if (qs.get('reminders_sent')) html += D.alertHtml('Serving reminders sent successfully.', 'success');

    /* ── ADMIN EDIT / CREATE MODE ── */
    if (_isAdmin && (editDate || creating)) {
      var rosterToEdit = editDate ? rosters.find(function (r) { return r.date === editDate; }) : null;
      var titleVal  = rosterToEdit ? rosterToEdit.title : 'Sunday Service';
      var typeVal   = rosterToEdit ? rosterToEdit.type  : 'sunday';
      var notesVal  = rosterToEdit ? rosterToEdit.notes : '';
      var dateVal   = rosterToEdit ? rosterToEdit.date  : '';
      var slots     = rosterToEdit ? (rosterToEdit.slots || []) : [];

      var autoTplId = '';
      if (!rosterToEdit && !slots.length) {
        var defTpl = templates.find(function (t) { return t.is_default; }) || templates[0];
        if (defTpl) {
          autoTplId = defTpl.id;
          (defTpl.slots || []).forEach(function (row) {
            for (var ci = 0; ci < (row.count || 1); ci++) {
              slots.push({ id: 'new_' + Math.random().toString(36).slice(2), role: row.role, assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' });
            }
          });
        }
      }

      var backUrl = '?tab=schedule';
      var assigneeOptsHtml = buildAssigneeOptions(profMap, guestMap);

      html += '<div class="mp-sched-edit-header"><a href="' + D.esc(backUrl) + '" class="mp-admin-back-link" onclick="window.mpDashboard.navigate(\'schedule\');return false;">&#8592; Back to Schedule</a>';
      html += '<h3 class="mp-sched-edit-title">' + (creating ? 'New Roster Event' : 'Edit: ' + D.esc(titleVal)) + '</h3></div>';

      html += '<form id="roster-form"><div class="mp-form-row" style="margin-bottom:16px;">';
      html += '<div class="mp-form-group"><label>Date <span class="mp-required">*</span></label><input type="date" name="roster_date" value="' + D.esc(dateVal) + '" required></div>';
      html += '<div class="mp-form-group"><label>Event Type</label><select name="roster_type" id="roster-type" onchange="mpSchedTypeChange(this.value)"><option value="sunday"' + (typeVal === 'sunday' ? ' selected' : '') + '>Sunday Service</option><option value="event"' + (typeVal === 'event' ? ' selected' : '') + '>Special Event</option></select></div>';
      html += '</div>';
      html += '<div class="mp-form-group" id="roster-title-group"' + (typeVal === 'sunday' ? ' style="display:none;"' : '') + '><label>Event Title</label><input type="text" name="roster_title" value="' + D.esc(titleVal) + '" placeholder="e.g. Easter Service 2026"></div>';
      if (templates.length) {
        html += '<div class="mp-tpl-load-bar">';
        html += '<span class="mp-tpl-load-label">Template:</span>';
        html += '<select id="roster-tpl-select" class="mp-tpl-load-select">';
        html += '<option value="">— none —</option>';
        templates.forEach(function (t) {
          html += '<option value="' + D.esc(t.id) + '"' + (t.id === autoTplId ? ' selected' : '') + '>' + D.esc(t.name) + (t.is_default ? ' ✓' : '') + '</option>';
        });
        html += '</select>';
        html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpRosterLoadTemplate(document.getElementById(\'roster-tpl-select\').value)">Apply</button>';
        html += '</div>';
      }
      html += '<div class="mp-section-divider">Volunteer Slots</div>';
      html += '<div id="slots-wrap">';
      slots.forEach(function (slot, i) {
        var selVal = '';
        if (slot.assignee_type === 'member' && slot.assignee_id) selVal = 'member:' + slot.assignee_id;
        else if (slot.assignee_type === 'couple' && slot.assignee_id) selVal = 'couple:' + slot.assignee_id + ':' + (slot.assignee_id_b || '');
        else if (slot.assignee_type === 'guest' && slot.guest_id) selVal = 'guest:' + slot.guest_id;
        html += '<div class="mp-sched-slot-row" data-idx="' + i + '">';
        html += '<input type="hidden" name="slots[' + i + '][id]" value="' + D.esc(slot.id || '') + '">';
        html += '<input type="text" name="slots[' + i + '][role]" value="' + D.esc(slot.role || '') + '" placeholder="Role" class="mp-sched-role-input">';
        html += '<select name="slots[' + i + '][assignee]" class="mp-sched-select">' + assigneeOptsHtml.replace('value="' + selVal + '"', 'value="' + selVal + '" selected') + '</select>';
        html += '<button type="button" class="mp-btn mp-btn--danger mp-btn--small mp-sched-remove-btn" onclick="this.closest(\'.mp-sched-slot-row\').remove()" title="Remove">&#10005;</button>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" style="margin-top:8px;" onclick="mpSchedAddRow()">+ Add Slot</button>';
      html += '<div class="mp-form-group" style="margin-top:20px;"><label>Notes <span class="mp-optional">(Optional)</span></label><textarea name="roster_notes" rows="2" placeholder="e.g. Extended service...">' + D.esc(notesVal) + '</textarea></div>';
      html += '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">Save Roster</button><a href="#" class="mp-btn mp-btn--secondary" onclick="window.mpDashboard.navigate(\'schedule\');return false;">Cancel</a></div>';
      html += '</form>';

      if (rosterToEdit) {
        html += '<form id="roster-del-form" style="margin-top:10px;" onsubmit="return confirm(\'Permanently delete this event?\');">';
        html += '<input type="hidden" name="del_date" value="' + D.esc(dateVal) + '">';
        html += '<button type="submit" class="mp-btn mp-btn--danger" style="width:auto;">Delete Roster Event</button></form>';
      }

      /* set globals BEFORE setContent — script tags inside innerHTML are never executed */
      window._schedAssigneeOpts = assigneeOptsHtml;
      window._mpSchedSlotIdx = slots.length;
      window._mpSchedTemplates = templates;

      D.setContent(html);

      var form = document.getElementById('roster-form');
      if (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(form);
          var date = fd.get('roster_date'), title = fd.get('roster_title') || 'Sunday Service';
          var type = fd.get('roster_type') || 'sunday', notes = fd.get('roster_notes') || '';
          if (!date) { alert('Date is required.'); return; }
          var slotsArr = [], slotEls = document.querySelectorAll('#slots-wrap .mp-sched-slot-row');
          slotEls.forEach(function (el, i) {
            var role = el.querySelector('input[type=text]').value.trim();
            if (!role) return;
            var asel = el.querySelector('select'); var combined = asel ? asel.value : '';
            var parts = combined.split(':'), aType = parts[0] || '', aId = parts[1] || '', aId2 = parts[2] || '';
            slotsArr.push({ id: el.querySelector('input[type=hidden]').value || ('slot_' + i), role: role, assignee_type: aType, assignee_id: aId, assignee_id_b: aId2, guest_id: aType === 'guest' ? aId : '' });
          });
          var payload = { date: date, title: title, type: type, notes: notes, slots: slotsArr };
          var existingRoster = rosters.find(function (r) { return r.date === date; });
          if (existingRoster) {
            await D.getSb().from('schedule_rosters').update(payload).eq('date', date);
          } else {
            await D.getSb().from('schedule_rosters').insert(payload);
          }
          var url = new URL(window.location.href);
          url.searchParams.set('tab', 'schedule'); url.searchParams.delete('sched_edit'); url.searchParams.delete('sched_new');
          url.searchParams.set('sched_saved', '1');
          window.history.pushState({}, '', url.toString());
          renderScheduleTab();
        });
      }
      var delForm = document.getElementById('roster-del-form');
      if (delForm) {
        delForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(delForm);
          await D.getSb().from('schedule_rosters').delete().eq('date', fd.get('del_date'));
          var url = new URL(window.location.href);
          url.searchParams.set('tab', 'schedule'); url.searchParams.delete('sched_edit');
          window.history.pushState({}, '', url.toString());
          renderScheduleTab();
        });
      }
      return;
    }

    /* ── CALENDAR ── */
    html += renderCalendarSection(calYear, calMonth, rosters, calEvents, uid, _isAdmin, D, teams, mcs);

    /* ── ROSTER STRIP (admins/leaders only) ── */
    if (_isAdmin) {
      html += '<div class="mp-section-divider" style="margin:8px 0 16px;">Roster Management</div>';
      html += '<div class="mp-sched-admin-bar">';
      html += '<a href="#" class="mp-btn mp-btn--primary mp-btn--small" onclick="mpSchedNew();return false;" style="width:auto;">+ New Roster</a>';
      html += '<button id="sched-bulk-dup" class="mp-btn mp-btn--secondary mp-btn--small" style="display:none;width:auto;" onclick="mpSchedBulk(\'duplicate\')">&#10697; Duplicate Selected</button>';
      html += '<button id="sched-bulk-del" class="mp-btn mp-btn--danger mp-btn--small" style="display:none;width:auto;" onclick="mpSchedBulk(\'delete\')">&#10005; Delete Selected</button>';
      html += '<button class="mp-btn mp-btn--outline mp-btn--small" style="width:auto;" onclick="mpSchedSendReminders()">&#9993; Send Reminders Now</button>';
      html += '</div>';

      /* ── template management panel ── */
      html += '<details class="mp-admin-panel" id="mp-tpl-mgmt"><summary class="mp-admin-toggle">Roster Templates <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
      if (templates.length) {
        html += '<div class="mp-tpl-list">';
        templates.forEach(function (t) { html += buildTemplateCardHtml(D, t); });
        html += '</div>';
      } else {
        html += '<p class="mp-empty" style="margin:0 0 14px;">No templates yet. Create one to quickly pre-fill volunteer slots when building rosters.</p>';
      }
      html += '<button class="mp-btn mp-btn--primary mp-btn--small" onclick="mpTplNew()">+ New Template</button>';
      html += '</div></details>';

      if (!rosters.length) {
        html += '<p class="mp-empty" style="text-align:center;padding:24px 0;">No rosters yet. Click <strong>+ New Roster</strong> to create one.</p>';
      } else {
        var upcomingIdx = 0;
        for (var vi = 0; vi < rosters.length; vi++) {
          if (rosters[vi].date >= todayStr) { upcomingIdx = vi; break; }
        }
        var GROUP_RULES = {
          'Music': ['music leader', 'musician', 'singer'],
          'Tech': ['sound', 'slides'],
          'Support': ['setup', 'bread', 'cleanup', 'clean up', 'lock up', 'lockup', 'greeter'],
          "Children's Ministry": ['children']
        };
        var GROUP_ORDER = ['Music', 'Tech', 'Support', "Children's Ministry"];

        html += '<div class="mp-sched-strip-container">';
        html += '<div class="mp-sched-scroll-mirror" id="sched-mirror"><div id="sched-mirror-inner" style="height:1px;"></div></div>';
        html += '<div class="mp-sched-strip-wrap" id="sched-wrap"><div class="mp-sched-strip" id="sched-strip">';

        rosters.forEach(function (roster, ri) {
          var rDate = roster.date, rTitle = roster.title || 'Sunday Service';
          var rType = roster.type || 'sunday', rNotes = roster.notes || '';
          var slots2 = roster.slots || [];
          var isPast = rDate < todayStr;
          var isMine = slots2.some(function (s) { return (s.assignee_type === 'member' && s.assignee_id === uid) || (s.assignee_type === 'couple' && (s.assignee_id === uid || s.assignee_id_b === uid)); });
          var isNext = rDate === nextSun;

          html += '<div class="mp-sched-card' + (isPast ? ' mp-sched-card--past' : '') + (isMine ? ' mp-sched-card--serving' : '') + (rType === 'event' ? ' mp-sched-card--event' : '') + '"' + (ri === upcomingIdx ? ' id="sched-upcoming"' : '') + '>';
          html += '<div class="mp-sched-card-header">';
          html += '<label class="mp-sched-card-cb" onclick="event.stopPropagation()"><input type="checkbox" class="sched-bulk-cb" value="' + D.esc(rDate) + '" onchange="mpSchedCbChange()"></label>';
          html += '<div class="mp-sched-card-date">' + D.esc(fmtShort(rDate)) + '</div>';
          html += '<div class="mp-sched-card-title">' + D.esc(rTitle) + (isNext && !isMine ? ' <span class="mp-sched-next-badge">This Week</span>' : '') + '</div>';
          html += '<a href="#" class="mp-sched-edit-link" onclick="mpSchedEdit(\'' + D.esc(rDate) + '\');return false;">Edit</a>';
          html += '</div>';
          if (rNotes) html += '<div class="mp-sched-card-notes">' + D.esc(rNotes) + '</div>';
          if (!slots2.length) { html += '<p class="mp-sched-card-empty">No slots assigned yet.</p>'; }
          else {
            var grouped = {}, ungrouped = [];
            GROUP_ORDER.forEach(function (g) { grouped[g] = []; });
            slots2.forEach(function (slot) {
              var rl = (slot.role || '').toLowerCase(), matched = false;
              for (var grp in GROUP_RULES) {
                if (GROUP_RULES[grp].some(function (kw) { return rl.indexOf(kw) !== -1; })) {
                  grouped[grp].push(slot); matched = true; break;
                }
              }
              if (!matched) ungrouped.push(slot);
            });
            html += '<div class="mp-sched-card-body">';
            if (ungrouped.length) {
              html += '<table class="mp-sched-card-table">';
              ungrouped.forEach(function (slot) {
                var name = assigneeName(slot, profMap, guestMap);
                var isMe = (slot.assignee_type === 'member' && slot.assignee_id === uid) || (slot.assignee_type === 'couple' && (slot.assignee_id === uid || slot.assignee_id_b === uid));
                html += '<tr' + (isMe ? ' class="mp-sched-row--me"' : '') + '><td class="mp-sched-td-role">' + D.esc(slot.role || '') + '</td><td class="mp-sched-td-name">' + (name ? D.esc(name) : '<span class="mp-sched-tbd">TBD</span>') + '</td></tr>';
              });
              html += '</table>';
            }
            GROUP_ORDER.forEach(function (grp) {
              if (!grouped[grp].length) return;
              html += '<details class="mp-sched-group"><summary class="mp-sched-group-header">' + D.esc(grp) + '</summary><table class="mp-sched-card-table">';
              grouped[grp].forEach(function (slot) {
                var name = assigneeName(slot, profMap, guestMap);
                var isMe = (slot.assignee_type === 'member' && slot.assignee_id === uid) || (slot.assignee_type === 'couple' && (slot.assignee_id === uid || slot.assignee_id_b === uid));
                html += '<tr' + (isMe ? ' class="mp-sched-row--me"' : '') + '><td class="mp-sched-td-role">' + D.esc(slot.role || '') + '</td><td class="mp-sched-td-name">' + (name ? D.esc(name) : '<span class="mp-sched-tbd">TBD</span>') + '</td></tr>';
              });
              html += '</table></details>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div></div></div>';
        html += '<p class="mp-sched-scroll-hint">&#8592; Scroll to see more events &#8594;</p>';
      }

      /* guest volunteers panel */
      html += '<details class="mp-admin-panel" style="margin-top:12px;"><summary class="mp-admin-toggle">Non-Member Volunteers <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
      html += '<form id="guest-form"><div class="mp-form-row"><div class="mp-form-group"><label>Name <span class="mp-required">*</span></label><input type="text" name="guest_name" required placeholder="Full name"></div><div class="mp-form-group"><label>Email</label><input type="email" name="guest_email" placeholder="For serving reminders"></div></div>';
      html += '<button type="submit" class="mp-btn mp-btn--primary" style="width:auto;">Add Volunteer</button></form>';
      if (guests.length) {
        html += '<div class="mp-section-title" style="margin-top:20px;">Volunteer List</div><ul class="mp-guest-list">';
        guests.forEach(function (g) {
          html += '<li class="mp-guest-row"><div class="mp-guest-info"><span class="mp-guest-name">' + D.esc(g.name) + '</span>' + (g.email ? '<span class="mp-guest-email">' + D.esc(g.email) + '</span>' : '') + '</div>';
          html += '<div class="mp-guest-actions"><button class="mp-btn mp-btn--small mp-btn--danger" onclick="mpGuestDelete(\'' + D.esc(g.id) + '\',\'' + D.esc(g.name) + '\')">Remove</button></div></li>';
        });
        html += '</ul>';
      }
      html += '</div></details>';
    }

    window._mpSchedTemplates = templates;
    D.setContent(html);

    /* scroll sync */
    if (_isAdmin) {
      requestAnimationFrame(function () {
        var wrap = document.getElementById('sched-wrap'), mirror = document.getElementById('sched-mirror'), strip = document.getElementById('sched-strip'), upcoming = document.getElementById('sched-upcoming');
        if (!wrap || !strip) return;
        var inner = document.getElementById('sched-mirror-inner');
        if (inner) inner.style.width = strip.scrollWidth + 'px';
        if (upcoming) {
          var wr = wrap.getBoundingClientRect(), cr = upcoming.getBoundingClientRect();
          var to = Math.max(0, (cr.left - wr.left + wrap.scrollLeft) - (wrap.offsetWidth / 2) + (cr.width / 2));
          wrap.scrollLeft = to; if (mirror) mirror.scrollLeft = to;
        }
        if (mirror) {
          var syncing = false;
          mirror.addEventListener('scroll', function () { if (!syncing) { syncing = true; wrap.scrollLeft = mirror.scrollLeft; syncing = false; } });
          wrap.addEventListener('scroll', function () { if (!syncing) { syncing = true; mirror.scrollLeft = wrap.scrollLeft; syncing = false; } });
        }
      });

      var gform = document.getElementById('guest-form');
      if (gform) {
        gform.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(gform);
          var name = (fd.get('guest_name') || '').trim(), email = fd.get('guest_email') || '';
          if (!name) { alert('Name is required.'); return; }
          await D.getSb().from('guests').insert({ name: name, email: email });
          renderScheduleTab();
        });
      }
    }
  }

  /* ── calendar export helpers ─────────────────────────────────── */
  var _icsSeq = 0;
  window._mpIcsData = {};

  function buildCalExportHtml(D, title, dateStr, timeStr, description) {
    var key = 'ics' + (++_icsSeq);
    window._mpIcsData[key] = { title: title, date: dateStr, time: timeStr || '', desc: description || '' };
    var gcDate = dateStr.replace(/-/g, '');
    var gcEndD = new Date(dateStr + 'T12:00:00'); gcEndD.setDate(gcEndD.getDate() + 1);
    var gcEnd = gcEndD.toISOString().split('T')[0].replace(/-/g, '');
    var gcDetails = timeStr ? ('Time: ' + timeStr + (description ? '\n' + description : '')) : (description || '');
    var gcUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(title)
      + '&dates=' + gcDate + '/' + gcEnd
      + (gcDetails ? '&details=' + encodeURIComponent(gcDetails) : '');
    var svg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    return '<div class="mp-cal-export-row">'
      + '<span class="mp-cal-export-label">Add to calendar:</span>'
      + '<a href="' + D.esc(gcUrl) + '" target="_blank" rel="noopener" class="mp-cal-export-btn">' + svg + ' Google</a>'
      + '<button type="button" class="mp-cal-export-btn" onclick="mpCalDownloadIcs(\'' + key + '\')">' + svg + ' Apple&nbsp;/&nbsp;iCal</button>'
      + '</div>';
  }

  window.mpCalDownloadIcs = function (key) {
    var data = window._mpIcsData[key]; if (!data) return;
    var icsDate = data.date.replace(/-/g, '');
    var endD = new Date(data.date + 'T12:00:00'); endD.setDate(endD.getDate() + 1);
    var icsEnd = endD.toISOString().split('T')[0].replace(/-/g, '');
    var stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    var uid = icsDate + '-' + key + '@commissionedcitychurch.ca';
    function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
    var desc = data.time ? ('Time: ' + data.time + (data.desc ? '\n' + data.desc : '')) : data.desc;
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Commissioned City Church//Members Portal//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + icsDate,
      'DTEND;VALUE=DATE:' + icsEnd,
      'SUMMARY:' + icsEsc(data.title)
    ];
    if (desc) lines.push('DESCRIPTION:' + icsEsc(desc));
    lines.push('END:VEVENT', 'END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (data.title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'event').replace(/\s+/g, '-') + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  /* ── calendar day click ─────────────────────────────────────── */
  window.mpCalDayClick = function (dateStr) {
    var cd = window._mpCalData; if (!cd) return;
    var D = cd.D;

    /* deselect previous */
    document.querySelectorAll('.mp-cal-day--selected').forEach(function (el) { el.classList.remove('mp-cal-day--selected'); });
    var cell = document.querySelector('.mp-cal-day[data-date="' + dateStr + '"]');
    if (cell) cell.classList.add('mp-cal-day--selected');

    var detail = document.getElementById('mp-cal-detail');
    if (!detail) return;

    var dayEvents = cd.calEvents.filter(function (ev) { return ev.event_date === dateStr; });
    var dayRoster = cd.rosters.find(function (r) { return r.date === dateStr; });
    var isServing = dayRoster && (dayRoster.slots || []).some(function (s) {
      return (s.assignee_type === 'member' && s.assignee_id === cd.uid) ||
             (s.assignee_type === 'couple' && (s.assignee_id === cd.uid || s.assignee_id_b === cd.uid));
    });

    if (!dayEvents.length && !dayRoster) {
      detail.style.display = 'none'; return;
    }

    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var d = new Date(dateStr + 'T12:00:00');
    var label = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    var html = '<div class="mp-cal-detail-title">' + D.esc(label) + '</div>';

    if (isServing) {
      var mySlots = (dayRoster.slots || []).filter(function (s) {
        return (s.assignee_type === 'member' && s.assignee_id === cd.uid) ||
               (s.assignee_type === 'couple' && (s.assignee_id === cd.uid || s.assignee_id_b === cd.uid));
      });
      var servingRoles = mySlots.map(function (s) { return s.role || ''; }).join(', ');
      html += '<div class="mp-cal-detail-serving">You are serving — ';
      html += D.esc(servingRoles);
      html += ' (' + D.esc(dayRoster.title || 'Sunday Service') + ')';
      html += buildCalExportHtml(D, dayRoster.title || 'Sunday Service', dateStr, null, 'Serving: ' + servingRoles);
      html += '</div>';
    } else if (dayRoster) {
      html += '<div class="mp-cal-detail-event"><div class="mp-cal-detail-event-title">' + D.esc(dayRoster.title || 'Sunday Service') + '</div>';
      html += '<div class="mp-cal-detail-event-meta">Church roster event</div>';
      html += buildCalExportHtml(D, dayRoster.title || 'Sunday Service', dateStr, null, null);
      html += '</div>';
    }

    dayEvents.forEach(function (ev) {
      var visLabel = ev.visibility === 'team' ? 'Team event' : ev.visibility === 'mc' ? 'MC event' : 'Church event';
      html += '<div class="mp-cal-detail-event">';
      html += '<div class="mp-cal-detail-event-title">' + D.esc(ev.title) + (ev.event_time ? ' &mdash; ' + D.esc(ev.event_time) : '') + '</div>';
      html += '<div class="mp-cal-detail-event-meta">' + visLabel + '</div>';
      if (ev.description) html += '<div class="mp-cal-detail-event-desc">' + D.esc(ev.description) + '</div>';
      html += buildCalExportHtml(D, ev.title, ev.event_date, ev.event_time || null, ev.description || null);
      if (cd.canManage) {
        html += '<div style="margin-top:8px;display:flex;gap:8px;">';
        html += '<button class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpCalEditEvent(\'' + D.esc(ev.id) + '\')">Edit</button>';
        html += '<button class="mp-btn mp-btn--danger mp-btn--small" onclick="mpCalDeleteEvent(\'' + D.esc(ev.id) + '\',\'' + D.esc(ev.title) + '\')">Delete</button>';
        html += '</div>';
      }
      html += '</div>';
    });

    detail.innerHTML = html;
    detail.style.display = '';
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /* ── calendar navigation ─────────────────────────────────────── */
  window.mpCalPrev = function () {
    if (_calState.month === 0) { _calState.month = 11; _calState.year--; }
    else { _calState.month--; }
    renderScheduleTab();
  };
  window.mpCalNext = function () {
    if (_calState.month === 11) { _calState.month = 0; _calState.year++; }
    else { _calState.month++; }
    renderScheduleTab();
  };

  /* ── event modal ─────────────────────────────────────────────── */
  function buildEventModal(D, teams, mcs, ev) {
    var isEdit = !!ev;
    var html = '<div class="mp-event-modal-overlay" id="mp-event-modal-overlay" onclick="if(event.target===this)mpCalCloseModal()">';
    html += '<div class="mp-event-modal">';
    html += '<div class="mp-event-modal-title">' + (isEdit ? 'Edit Event' : 'Add Church Event') + '</div>';
    html += '<form id="mp-event-form">';
    if (isEdit) html += '<input type="hidden" name="event_id" value="' + D.esc(ev.id) + '">';
    html += '<div class="mp-form-group"><label>Title <span class="mp-required">*</span></label><input type="text" name="event_title" value="' + D.esc(isEdit ? ev.title : '') + '" required placeholder="e.g. Church Picnic"></div>';
    html += '<div class="mp-form-row"><div class="mp-form-group"><label>Date <span class="mp-required">*</span></label><input type="date" name="event_date" value="' + D.esc(isEdit ? ev.event_date : '') + '" required></div>';
    html += '<div class="mp-form-group"><label>Time <span class="mp-optional">(Optional)</span></label><input type="text" name="event_time" value="' + D.esc(isEdit ? (ev.event_time || '') : '') + '" placeholder="e.g. 6:30 PM"></div></div>';
    html += '<div class="mp-form-group"><label>Description <span class="mp-optional">(Optional)</span></label><textarea name="event_description" rows="2" placeholder="Brief description...">' + D.esc(isEdit ? (ev.description || '') : '') + '</textarea></div>';
    html += '<div class="mp-form-group"><label>Visible To</label>';
    html += '<select name="event_visibility" id="mp-event-vis" onchange="mpCalVisChange(this.value)">';
    html += '<option value="all"' + (!isEdit || ev.visibility === 'all' ? ' selected' : '') + '>All Members (default)</option>';
    html += '<option value="team"' + (isEdit && ev.visibility === 'team' ? ' selected' : '') + '>Specific Team</option>';
    html += '<option value="mc"' + (isEdit && ev.visibility === 'mc' ? ' selected' : '') + '>Specific MC</option>';
    html += '</select></div>';

    var teamVis = isEdit && ev.visibility === 'team' ? '' : 'display:none;';
    var mcVis   = isEdit && ev.visibility === 'mc'   ? '' : 'display:none;';
    html += '<div class="mp-form-group" id="mp-event-team-group" style="' + teamVis + '"><label>Team</label><select name="event_team_id">';
    html += '<option value="">— Select Team —</option>';
    teams.forEach(function (t) { html += '<option value="' + D.esc(t.id) + '"' + (isEdit && ev.target_team_id === t.id ? ' selected' : '') + '>' + D.esc(t.name) + '</option>'; });
    html += '</select></div>';
    html += '<div class="mp-form-group" id="mp-event-mc-group" style="' + mcVis + '"><label>Missional Community</label><select name="event_mc_id">';
    html += '<option value="">— Select MC —</option>';
    mcs.forEach(function (m) { html += '<option value="' + D.esc(m.id) + '"' + (isEdit && ev.target_mc_id === m.id ? ' selected' : '') + '>' + D.esc(m.name) + '</option>'; });
    html += '</select></div>';

    html += '<div class="mp-event-modal-footer">';
    html += '<button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">' + (isEdit ? 'Save Changes' : 'Add Event') + '</button>';
    html += '<button type="button" class="mp-btn mp-btn--secondary" onclick="mpCalCloseModal()">Cancel</button>';
    html += '</div></form></div></div>';
    return html;
  }

  function openEventModal(D, teams, mcs, ev) {
    var existing = document.getElementById('mp-event-modal-overlay');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.innerHTML = buildEventModal(D, teams, mcs, ev);
    document.body.appendChild(div.firstChild);

    document.getElementById('mp-event-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var vis = fd.get('event_visibility');
      var payload = {
        title: (fd.get('event_title') || '').trim(),
        event_date: fd.get('event_date'),
        event_time: fd.get('event_time') || '',
        description: fd.get('event_description') || '',
        visibility: vis,
        target_team_id: vis === 'team' ? (fd.get('event_team_id') || null) : null,
        target_mc_id:   vis === 'mc'   ? (fd.get('event_mc_id')   || null) : null,
        created_by: window.mpDashboard.getProfile().id
      };
      if (!payload.title || !payload.event_date) { alert('Title and date are required.'); return; }
      var evId = fd.get('event_id');
      var sb = window.mpDashboard.getSb();
      if (evId) {
        await sb.from('events').update(payload).eq('id', evId);
      } else {
        await sb.from('events').insert(payload);
      }
      mpCalCloseModal();
      renderScheduleTab();
    });
  }

  window.mpCalAddEvent = function () {
    var cd = window._mpCalData; if (!cd || !cd.canManage) return;
    openEventModal(cd.D, cd.teams, cd.mcs, null);
  };
  window.mpCalEditEvent = function (id) {
    var cd = window._mpCalData; if (!cd) return;
    var ev = cd.calEvents.find(function (e) { return e.id === id; });
    if (ev) openEventModal(cd.D, cd.teams, cd.mcs, ev);
  };
  window.mpCalDeleteEvent = async function (id, title) {
    if (!confirm('Delete event "' + title + '"?')) return;
    var cd = window._mpCalData; if (!cd) return;
    await cd.sb.from('events').delete().eq('id', id);
    renderScheduleTab();
  };
  window.mpCalCloseModal = function () {
    var el = document.getElementById('mp-event-modal-overlay');
    if (el) el.remove();
  };
  window.mpCalVisChange = function (val) {
    var tg = document.getElementById('mp-event-team-group'), mg = document.getElementById('mp-event-mc-group');
    if (tg) tg.style.display = val === 'team' ? '' : 'none';
    if (mg) mg.style.display = val === 'mc'   ? '' : 'none';
  };

  /* ── template builder helpers ───────────────────────────────── */
  function buildTemplateCardHtml(D, t) {
    var html = '<div class="mp-tpl-card">';
    html += '<div class="mp-tpl-card-hd">';
    html += '<span class="mp-tpl-card-name" title="' + D.esc(t.name) + '">' + D.esc(t.name) + '</span>';
    if (t.is_default) html += '<span class="mp-admin-badge" style="font-size:0.7rem;padding:1px 6px;margin-right:2px;flex-shrink:0;">Default</span>';
    html += '<div class="mp-tpl-card-actions">';
    if (!t.is_default) html += '<button class="mp-btn mp-btn--small mp-btn--outline" onclick="mpTplSetDefault(\'' + D.esc(t.id) + '\')">Set Default</button>';
    html += '<button class="mp-btn mp-btn--small mp-btn--secondary" onclick="mpTplEdit(\'' + D.esc(t.id) + '\')">Edit</button>';
    html += '<button class="mp-btn mp-btn--small mp-btn--danger" onclick="mpTplDelete(\'' + D.esc(t.id) + '\',\'' + D.esc(t.name) + '\')">Delete</button>';
    html += '</div></div>';
    var tSlots = t.slots || [];
    if (tSlots.length) {
      html += '<div class="mp-tpl-slots">';
      tSlots.forEach(function (s) {
        html += '<div class="mp-tpl-slot-row"><span>' + D.esc(s.role || '') + '</span><span class="mp-tpl-slot-count">×' + (s.count || 1) + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<p class="mp-empty" style="padding:8px 12px;margin:0;font-size:0.82rem;">No roles defined.</p>';
    }
    html += '</div>';
    return html;
  }

  function buildTplRoleRow(role, count) {
    var esc = window.mpDashboard ? window.mpDashboard.esc : function (s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    return '<div class="mp-tpl-role-row">'
      + '<input type="text" class="mp-tpl-role-input" placeholder="Role name (e.g. Music Leader)" value="' + esc(role || '') + '">'
      + '<div class="mp-tpl-count-wrap"><span class="mp-tpl-count-label">×</span>'
      + '<input type="number" class="mp-tpl-count-input" min="1" max="20" value="' + (parseInt(count, 10) || 1) + '"></div>'
      + '<div class="mp-tpl-order-btns">'
      + '<button type="button" class="mp-tpl-order-btn" onclick="mpTplMoveRow(this,-1)" title="Move up">↑</button>'
      + '<button type="button" class="mp-tpl-order-btn" onclick="mpTplMoveRow(this,1)" title="Move down">↓</button>'
      + '</div>'
      + '<button type="button" class="mp-btn mp-btn--danger mp-btn--small" onclick="this.closest(\'.mp-tpl-role-row\').remove()" title="Remove">&#10005;</button>'
      + '</div>';
  }

  function openTplModal(D, tpl) {
    var isEdit = !!tpl;
    var tSlots = isEdit ? (tpl.slots || []) : [];
    var html = '<div class="mp-event-modal-overlay" id="mp-tpl-modal-overlay" onclick="if(event.target===this)mpTplCloseModal()">';
    html += '<div class="mp-event-modal" style="width:min(520px,94vw);">';
    html += '<div class="mp-event-modal-title">' + (isEdit ? 'Edit: ' + D.esc(tpl.name) : 'New Roster Template') + '</div>';
    html += '<form id="mp-tpl-form">';
    if (isEdit) html += '<input type="hidden" name="tpl_id" value="' + D.esc(tpl.id) + '">';
    html += '<div class="mp-form-group"><label>Template Name <span class="mp-required">*</span></label>';
    html += '<input type="text" name="tpl_name" value="' + D.esc(isEdit ? tpl.name : '') + '" required placeholder="e.g. Sunday Service"></div>';
    html += '<div class="mp-section-divider" style="margin:14px 0 10px;">Roles — listed in order, each with a count</div>';
    html += '<div id="mp-tpl-roles">';
    tSlots.forEach(function (s) { html += buildTplRoleRow(s.role, s.count); });
    html += '</div>';
    html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" style="margin-bottom:14px;" onclick="mpTplAddRoleRow()">+ Add Role</button>';
    html += '<div class="mp-event-modal-footer">';
    html += '<button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">' + (isEdit ? 'Save Changes' : 'Create Template') + '</button>';
    html += '<button type="button" class="mp-btn mp-btn--secondary" onclick="mpTplCloseModal()">Cancel</button>';
    html += '</div></form></div></div>';

    var existing = document.getElementById('mp-tpl-modal-overlay');
    if (existing) existing.remove();
    var el = document.createElement('div'); el.innerHTML = html;
    document.body.appendChild(el.firstChild);

    document.getElementById('mp-tpl-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var name = (fd.get('tpl_name') || '').trim();
      if (!name) { alert('Template name is required.'); return; }
      var tplId = fd.get('tpl_id') || '';
      var newSlots = [];
      document.querySelectorAll('#mp-tpl-roles .mp-tpl-role-row').forEach(function (row) {
        var ri = row.querySelector('.mp-tpl-role-input'), ci = row.querySelector('.mp-tpl-count-input');
        var role = (ri ? ri.value.trim() : '');
        var count = ci ? (parseInt(ci.value, 10) || 1) : 1;
        if (role) newSlots.push({ role: role, count: count });
      });
      var sb = window.mpDashboard.getSb();
      if (tplId) {
        await sb.from('schedule_templates').update({ name: name, slots: newSlots }).eq('id', tplId);
      } else {
        var firstEver = !(window._mpSchedTemplates && window._mpSchedTemplates.length);
        await sb.from('schedule_templates').insert({ name: name, slots: newSlots, is_default: firstEver });
      }
      mpTplCloseModal();
      renderScheduleTab();
    });
  }

  window.mpTplNew = function () { openTplModal(window.mpDashboard, null); };
  window.mpTplEdit = function (id) {
    var tpl = (window._mpSchedTemplates || []).find(function (t) { return t.id === id; });
    if (tpl) openTplModal(window.mpDashboard, tpl);
  };
  window.mpTplDelete = async function (id, name) {
    if (!confirm('Delete the template "' + name + '"?')) return;
    await window.mpDashboard.getSb().from('schedule_templates').delete().eq('id', id);
    renderScheduleTab();
  };
  window.mpTplSetDefault = async function (id) {
    var sb = window.mpDashboard.getSb();
    await sb.from('schedule_templates').update({ is_default: false }).neq('id', id);
    await sb.from('schedule_templates').update({ is_default: true }).eq('id', id);
    renderScheduleTab();
  };
  window.mpTplCloseModal = function () {
    var el = document.getElementById('mp-tpl-modal-overlay'); if (el) el.remove();
  };
  window.mpTplMoveRow = function (btn, dir) {
    var row = btn.closest('.mp-tpl-role-row');
    var list = document.getElementById('mp-tpl-roles');
    if (!row || !list) return;
    if (dir < 0) { var prev = row.previousElementSibling; if (prev) list.insertBefore(row, prev); }
    else         { var nxt  = row.nextElementSibling;     if (nxt)  list.insertBefore(nxt, row); }
  };
  window.mpTplAddRoleRow = function () {
    var list = document.getElementById('mp-tpl-roles'); if (!list) return;
    var tmp = document.createElement('div'); tmp.innerHTML = buildTplRoleRow('', 1);
    var newRow = tmp.firstChild; list.appendChild(newRow);
    var inp = newRow.querySelector('.mp-tpl-role-input'); if (inp) inp.focus();
  };
  window.mpRosterLoadTemplate = function (tplId) {
    if (!tplId) return;
    var tpl = (window._mpSchedTemplates || []).find(function (t) { return t.id === tplId; });
    if (!tpl || !tpl.slots) return;
    var wrap = document.getElementById('slots-wrap'); if (!wrap) return;
    var esc = window.mpDashboard.esc;
    wrap.innerHTML = ''; var i = 0;
    tpl.slots.forEach(function (row) {
      for (var ci = 0; ci < (row.count || 1); ci++) {
        var d = document.createElement('div');
        d.className = 'mp-sched-slot-row'; d.dataset.idx = i;
        d.innerHTML = '<input type="hidden" name="slots[' + i + '][id]" value="new_' + i + '">'
          + '<input type="text" name="slots[' + i + '][role]" value="' + esc(row.role || '') + '" placeholder="Role" class="mp-sched-role-input">'
          + '<select name="slots[' + i + '][assignee]" class="mp-sched-select">' + (window._schedAssigneeOpts || '') + '</select>'
          + '<button type="button" class="mp-btn mp-btn--danger mp-btn--small mp-sched-remove-btn" onclick="this.closest(\'.mp-sched-slot-row\').remove()" title="Remove">&#10005;</button>';
        wrap.appendChild(d); i++;
      }
    });
    window._mpSchedSlotIdx = i;
  };

  /* ── roster edit-form globals ────────────────────────────────── */
  window.mpSchedTypeChange = function (v) {
    var g = document.getElementById('roster-title-group');
    if (g) g.style.display = v === 'event' ? '' : 'none';
  };
  window.mpSchedAddRow = function () {
    var w = document.getElementById('slots-wrap'); if (!w) return;
    var i = window._mpSchedSlotIdx++;
    var d = document.createElement('div');
    d.className = 'mp-sched-slot-row'; d.dataset.idx = i;
    d.innerHTML = '<input type="hidden" name="slots[' + i + '][id]" value="">'
      + '<input type="text" name="slots[' + i + '][role]" placeholder="Role" class="mp-sched-role-input">'
      + '<select name="slots[' + i + '][assignee]" class="mp-sched-select">'
      + (window._schedAssigneeOpts || '') + '</select>'
      + '<button type="button" class="mp-btn mp-btn--danger mp-btn--small"'
      + ' onclick="this.closest(\'.mp-sched-slot-row\').remove()">&#10005;</button>';
    w.appendChild(d); d.querySelector('input[type=text]').focus();
  };

  /* ── existing roster globals ─────────────────────────────────── */
  window.mpSchedNew = function () {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'schedule'); url.searchParams.set('sched_new', '1'); url.searchParams.delete('sched_edit');
    window.history.pushState({}, '', url.toString());
    renderScheduleTab();
  };
  window.mpSchedEdit = function (date) {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', 'schedule'); url.searchParams.set('sched_edit', date); url.searchParams.delete('sched_new');
    window.history.pushState({}, '', url.toString());
    renderScheduleTab();
  };
  window.mpSchedCbChange = function () {
    var checked = document.querySelectorAll('.sched-bulk-cb:checked').length;
    var dup = document.getElementById('sched-bulk-dup'), del = document.getElementById('sched-bulk-del');
    if (dup) dup.style.display = checked ? '' : 'none';
    if (del) del.style.display = checked ? '' : 'none';
  };
  window.mpSchedBulk = async function (action) {
    var cbs = document.querySelectorAll('.sched-bulk-cb:checked');
    if (!cbs.length) return;
    var dates = Array.from(cbs).map(function (cb) { return cb.value; });
    if (!confirm((action === 'delete' ? 'Delete' : 'Duplicate') + ' ' + dates.length + ' event(s)?')) return;
    var _sb2 = window.mpDashboard.getSb();
    if (action === 'delete') {
      await _sb2.from('schedule_rosters').delete().in('date', dates);
    } else {
      var { data: toClone } = await _sb2.from('schedule_rosters').select('*').in('date', dates);
      if (toClone) {
        var inserts = toClone.map(function (r) {
          var nd = new Date(r.date + 'T12:00:00'); nd.setDate(nd.getDate() + 7);
          return { date: nd.toISOString().split('T')[0], title: r.title, type: r.type, notes: '', slots: (r.slots || []).map(function (s) { return Object.assign({}, s, { id: 'slot_' + Math.random().toString(36).slice(2), assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' }); }) };
        });
        await _sb2.from('schedule_rosters').insert(inserts);
      }
    }
    renderScheduleTab();
  };
  window.mpSchedSendReminders = async function () {
    if (!confirm('Send serving reminder emails now?')) return;
    await window.mpDashboard.callEdge('send-reminders', { force: true });
    var url = new URL(window.location.href); url.searchParams.set('reminders_sent', '1');
    window.history.replaceState({}, '', url.toString());
    renderScheduleTab();
  };
  window.mpGuestDelete = async function (id, name) {
    if (!confirm('Remove ' + name + '?')) return;
    await window.mpDashboard.getSb().from('guests').delete().eq('id', id);
    renderScheduleTab();
  };

})();
