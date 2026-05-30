/**
 * DASHBOARD MODULE — Part C: Schedule tab
 * Requires dashboard.js to be loaded first.
 */
(function () {
  'use strict';

  var MAX_WAIT = 60, waited = 0;
  function tryRegister() {
    if (window.mpDashboard && window.mpDashboard.getSb) { register(); }
    else if (waited < MAX_WAIT) { waited++; setTimeout(tryRegister, 100); }
  }
  function register() { window.mpDashboard.render_schedule = renderScheduleTab; }
  tryRegister();

  /* ── helpers ─────────────────────────────────────────────── */
  function nextSunday() {
    var now = new Date(), dow = now.getDay();
    var days = (dow === 0 && now.getHours() >= 12) ? 7 : ((7 - dow) % 7 === 0 ? 0 : (7 - dow) % 7);
    var d = new Date(now); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  function sundayAfter(dateStr) {
    var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 7);
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
    /* individual members */
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
    /* guests */
    var guestOpts = Object.values(guestMap).map(function (g) {
      return '<option value="guest:' + D.esc(g.id) + '">' + D.esc(g.name + ' (guest)') + '</option>';
    }).join('');
    if (guestOpts) html += '<optgroup label="Non-Member Volunteers">' + guestOpts + '</optgroup>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDERER
     ══════════════════════════════════════════════════════════════ */
  async function renderScheduleTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _profile = D.getProfile(), _isAdmin = D.isAdmin();
    var _isLeader = D.isLeader();
    /* leaders get full schedule editing — they need to manage rosters */
    if (_isLeader) _isAdmin = true;
    var uid = _profile.id;
    var qs = new URLSearchParams(window.location.search);
    var editDate = qs.get('sched_edit') || '';
    var creating = _isAdmin && qs.has('sched_new');

    /* parallel fetch */
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    var cutoffStr = cutoff.toISOString().split('T')[0];

    var [rostersRes, templatesRes, guestsRes, approvedRes] = await Promise.all([
      _sb.from('schedule_rosters').select('*').gte('date', cutoffStr).order('date'),
      _sb.from('schedule_templates').select('*').order('is_default', { ascending: false }),
      _sb.from('guests').select('*').order('name'),
      _sb.from('profiles').select('id,first_name,last_name,full_name,email,phone1,phone1_type,spouse_id').eq('status', 'approved')
    ]);
    var rosters   = rostersRes.data || [];
    var templates = templatesRes.data || [];
    var guests    = guestsRes.data || [];
    var approved  = approvedRes.data || [];

    var profMap = {}, guestMap = {};
    approved.forEach(function (p) { profMap[p.id] = p; });
    guests.forEach(function (g) { guestMap[g.id] = g; });

    var todayStr = new Date().toISOString().split('T')[0];
    var nextSun  = nextSunday();

    var html = '<h2 class="mp-tab-title">Schedule</h2>';

    /* flash messages */
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

      /* if creating new with no slots, expand default template */
      if (!rosterToEdit && !slots.length) {
        var defTpl = templates.find(function (t) { return t.is_default; }) || templates[0];
        if (defTpl) {
          (defTpl.slots || []).forEach(function (row) {
            for (var ci = 0; ci < (row.count || 1); ci++) {
              slots.push({ id: 'new_' + Math.random().toString(36).slice(2), role: row.role, assignee_type: '', assignee_id: '', assignee_id_b: '', guest_id: '' });
            }
          });
        }
      }

      var backUrl = '?tab=schedule';
      var assigneeOptsHtml = buildAssigneeOptions(profMap, guestMap);

      html += '<div class="mp-sched-edit-header"><a href="' + D.esc(backUrl) + '" class="mp-admin-back-link" onclick="window.mpDashboard.navigate(\'schedule\');return false;">← Back to Schedule</a>';
      html += '<h3 class="mp-sched-edit-title">' + (creating ? 'New Event' : 'Edit: ' + D.esc(titleVal)) + '</h3></div>';

      html += '<form id="roster-form"><div class="mp-form-row" style="margin-bottom:16px;">';
      html += '<div class="mp-form-group"><label>Date <span class="mp-required">*</span></label><input type="date" name="roster_date" value="' + D.esc(dateVal) + '" required></div>';
      html += '<div class="mp-form-group"><label>Event Type</label><select name="roster_type" id="roster-type" onchange="mpSchedTypeChange(this.value)"><option value="sunday"' + (typeVal === 'sunday' ? ' selected' : '') + '>Sunday Service</option><option value="event"' + (typeVal === 'event' ? ' selected' : '') + '>Special Event</option></select></div>';
      html += '</div>';
      html += '<div class="mp-form-group" id="roster-title-group"' + (typeVal === 'sunday' ? ' style="display:none;"' : '') + '><label>Event Title</label><input type="text" name="roster_title" value="' + D.esc(titleVal) + '" placeholder="e.g. Easter Service 2026"></div>';
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
        html += '<button type="button" class="mp-btn mp-btn--danger mp-btn--small mp-sched-remove-btn" onclick="this.closest(\'.mp-sched-slot-row\').remove()" title="Remove">✕</button>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" style="margin-top:8px;" onclick="mpSchedAddRow()">+ Add Slot</button>';
      html += '<div class="mp-form-group" style="margin-top:20px;"><label>Notes <span class="mp-optional">(Optional)</span></label><textarea name="roster_notes" rows="2" placeholder="e.g. Extended service…">' + D.esc(notesVal) + '</textarea></div>';
      html += '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">Save Event</button><a href="#" class="mp-btn mp-btn--secondary" onclick="window.mpDashboard.navigate(\'schedule\');return false;">Cancel</a></div>';
      html += '</form>';

      if (rosterToEdit) {
        html += '<form id="roster-del-form" style="margin-top:10px;" onsubmit="return confirm(\'Permanently delete this event?\');">';
        html += '<input type="hidden" name="del_date" value="' + D.esc(dateVal) + '">';
        html += '<button type="submit" class="mp-btn mp-btn--danger" style="width:auto;">Delete Event</button></form>';
      }

      html += '<script>window._schedAssigneeOpts=' + JSON.stringify(assigneeOptsHtml) + ';<\/script>';
      html += '<script>window.mpSchedTypeChange=function(v){var g=document.getElementById("roster-title-group");if(g)g.style.display=v==="event"?"":"none";};';
      html += 'var mpSlotIdx=' + slots.length + ';';
      html += 'window.mpSchedAddRow=function(){var w=document.getElementById("slots-wrap");if(!w)return;var i=mpSlotIdx++;var d=document.createElement("div");d.className="mp-sched-slot-row";d.dataset.idx=i;d.innerHTML=\'<input type="hidden" name="slots[\'+i+\'][id]" value=""><input type="text" name="slots[\'+i+\'][role]" placeholder="Role" class="mp-sched-role-input"><select name="slots[\'+i+\'][assignee]" class="mp-sched-select">\'+window._schedAssigneeOpts+\'</select><button type="button" class="mp-btn mp-btn--danger mp-btn--small" onclick="this.closest(\\".mp-sched-slot-row\\").remove()">✕</button>\';w.appendChild(d);d.querySelector("input[type=text]").focus();};<\/script>';

      D.setContent(html);

      /* wire roster save form */
      var form = document.getElementById('roster-form');
      if (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(form);
          var date = fd.get('roster_date'), title = fd.get('roster_title') || 'Sunday Service';
          var type = fd.get('roster_type') || 'sunday', notes = fd.get('roster_notes') || '';
          if (!date) { alert('Date is required.'); return; }

          /* collect slots */
          var slotsArr = [], slotEls = document.querySelectorAll('#slots-wrap .mp-sched-slot-row');
          slotEls.forEach(function (el, i) {
            var role = el.querySelector('input[type=text]').value.trim();
            if (!role) return;
            var asel = el.querySelector('select'); var combined = asel ? asel.value : '';
            var parts = combined.split(':'), aType = parts[0] || '', aId = parts[1] || '', aId2 = parts[2] || '';
            slotsArr.push({ id: el.querySelector('input[type=hidden]').value || ('slot_' + i), role, assignee_type: aType, assignee_id: aId, assignee_id_b: aId2, guest_id: aType === 'guest' ? aId : '' });
          });

          var payload = { date, title, type, notes, slots: slotsArr };
          var existingRoster = rosters.find(function (r) { return r.date === date; });
          var _sb2 = D.getSb();
          if (existingRoster) {
            await _sb2.from('schedule_rosters').update(payload).eq('date', date);
          } else {
            await _sb2.from('schedule_rosters').insert(payload);
          }
          var url = new URL(window.location.href);
          url.searchParams.set('tab', 'schedule'); url.searchParams.delete('sched_edit'); url.searchParams.delete('sched_new');
          url.searchParams.set('sched_saved', '1');
          window.history.pushState({}, '', url.toString());
          renderScheduleTab();
        });
      }

      /* wire delete form */
      var delForm = document.getElementById('roster-del-form');
      if (delForm) {
        delForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(delForm);
          var del_date = fd.get('del_date');
          await D.getSb().from('schedule_rosters').delete().eq('date', del_date);
          var url = new URL(window.location.href);
          url.searchParams.set('tab', 'schedule'); url.searchParams.delete('sched_edit');
          window.history.pushState({}, '', url.toString());
          renderScheduleTab();
        });
      }

      return; /* don't render the card strip */
    }

    /* ── MEMBER/ADMIN CARD STRIP VIEW ── */
    if (_isAdmin) {
      html += '<div class="mp-sched-admin-bar">';
      html += '<a href="#" class="mp-btn mp-btn--primary mp-btn--small" onclick="mpSchedNew();return false;" style="width:auto;">+ New Event</a>';
      html += '<button id="sched-bulk-dup" class="mp-btn mp-btn--secondary mp-btn--small" style="display:none;width:auto;" onclick="mpSchedBulk(\'duplicate\')">⧉ Duplicate Selected</button>';
      html += '<button id="sched-bulk-del" class="mp-btn mp-btn--danger mp-btn--small" style="display:none;width:auto;" onclick="mpSchedBulk(\'delete\')">✕ Delete Selected</button>';
      html += '<button class="mp-btn mp-btn--outline mp-btn--small" style="width:auto;" onclick="mpSchedSendReminders()">✉ Send Reminders Now</button>';
      html += '</div>';
    }

    if (!rosters.length) {
      html += '<p class="mp-empty" style="text-align:center;padding:32px 0;">No upcoming events scheduled yet.' + (_isAdmin ? ' Click <strong>+ New Event</strong> to create one.' : '') + '</p>';
      D.setContent(html);
      return;
    }

    /* find index of first upcoming card */
    var upcomingIdx = 0;
    for (var vi = 0; vi < rosters.length; vi++) {
      if (rosters[vi].date >= todayStr) { upcomingIdx = vi; break; }
    }

    /* role grouping */
    var GROUP_RULES = {
      'Music':              ['music leader', 'musician', 'singer'],
      'Tech':               ['sound', 'slides'],
      'Support':            ['setup', 'bread', 'cleanup', 'clean up', 'lock up', 'lockup', 'greeter'],
      "Children's Ministry":['children']
    };
    var GROUP_ORDER = ['Music', 'Tech', 'Support', "Children's Ministry"];

    html += '<div class="mp-sched-strip-container">';
    html += '<div class="mp-sched-scroll-mirror" id="sched-mirror"><div id="sched-mirror-inner" style="height:1px;"></div></div>';
    html += '<div class="mp-sched-strip-wrap" id="sched-wrap"><div class="mp-sched-strip" id="sched-strip">';

    var bulkDates = [];
    rosters.forEach(function (roster, ri) {
      var rDate = roster.date, rTitle = roster.title || 'Sunday Service';
      var rType = roster.type || 'sunday', rNotes = roster.notes || '';
      var slots2 = roster.slots || [];
      var isPast  = rDate < todayStr;
      var isMine  = slots2.some(function (s) { return (s.assignee_type === 'member' && s.assignee_id === uid) || (s.assignee_type === 'couple' && (s.assignee_id === uid || s.assignee_id_b === uid)); });
      var isNext  = rDate === nextSun;

      html += '<div class="mp-sched-card' + (isPast ? ' mp-sched-card--past' : '') + (isMine ? ' mp-sched-card--serving' : '') + (rType === 'event' ? ' mp-sched-card--event' : '') + '"' + (ri === upcomingIdx ? ' id="sched-upcoming"' : '') + '>';
      html += '<div class="mp-sched-card-header">';
      if (_isAdmin) html += '<label class="mp-sched-card-cb" onclick="event.stopPropagation()"><input type="checkbox" class="sched-bulk-cb" value="' + D.esc(rDate) + '" onchange="mpSchedCbChange()"></label>';
      html += '<div class="mp-sched-card-date">' + D.esc(fmtShort(rDate)) + '</div>';
      html += '<div class="mp-sched-card-title">' + D.esc(rTitle) + (isNext && !isMine ? ' <span class="mp-sched-next-badge">This Week</span>' : '') + '</div>';
      if (_isAdmin) html += '<a href="#" class="mp-sched-edit-link" onclick="mpSchedEdit(\'' + D.esc(rDate) + '\');return false;">Edit</a>';
      html += '</div>';
      if (rNotes) html += '<div class="mp-sched-card-notes">' + D.esc(rNotes) + '</div>';
      if (!slots2.length) { html += '<p class="mp-sched-card-empty">No slots assigned yet.</p>'; }
      else {
        /* group slots */
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
      html += '</div>'; /* end card */
      bulkDates.push(rDate);
    });

    html += '</div></div></div>'; /* strip/wrap/container */
    html += '<p class="mp-sched-scroll-hint">← Scroll to see more events →</p>';

    /* guest volunteers panel (admin) */
    if (_isAdmin) {
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

    D.setContent(html);

    /* scroll sync + center upcoming */
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

    /* wire guest form */
    var gform = document.getElementById('guest-form');
    if (gform) {
      gform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(gform);
        var name = (fd.get('guest_name') || '').trim(), email = fd.get('guest_email') || '';
        if (!name) { alert('Name is required.'); return; }
        await D.getSb().from('guests').insert({ name, email });
        renderScheduleTab();
      });
    }
  }

  /* global schedule actions */
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
      /* duplicate: shift each by 7 days */
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
    await window.mpDashboard.callEdge('send-reminders', {});
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
