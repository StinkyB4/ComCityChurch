// =============================================================================
// Shared seed dataset for the members-portal mock tests.
//
// Models a realistic Sunday-serving scenario as if "the scheduler" had already
// built it, so we can verify (a) volunteer welcome-page notifications,
// (b) children scheduling, and (c) reminder emails — all without a live backend.
//
// Cast:
//   Pastor Tim (admin / the scheduler)
//   Brennan + Sarah (married couple, both volunteers; parents of Noah & Ella)
//   Mike + Jen   (married couple, serve A/V together)
//   Grace        (single volunteer)
//   Guest "Jordan Avery" (non-member volunteer with an email)
// =============================================================================

/** Soonest Sunday on/after `from` (mirrors send-reminders nextSunday, minus the
 *  Sunday-afternoon roll-forward so the demo always has a "this Sunday"). */
function thisSunday(from = new Date()) {
  const d = new Date(from);
  const add = (7 - d.getDay()) % 7; // 0 if today is Sunday
  d.setDate(d.getDate() + add);
  return d.toISOString().split('T')[0];
}
function plusDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function buildSeed(now = new Date()) {
  const SUN1 = thisSunday(now);       // this Sunday
  const SUN2 = plusDays(SUN1, 7);     // next Sunday
  const SUN3 = plusDays(SUN1, 14);
  const todayStr = now.toISOString().split('T')[0];

  // ── people ────────────────────────────────────────────────────────────────
  const P = (id, first, last, extra = {}) => ({
    id, first_name: first, last_name: last, full_name: `${first} ${last}`,
    email: `${first.toLowerCase()}@example.com`,
    phone1: '204-555-0100', phone1_type: 'Cell', phone2: '', phone2_type: 'Home',
    role: 'member', status: 'approved', avatar_url: '',
    spouse_id: null, child_notif_optout: false, preferred_community: null,
    profile_reminder_dismissed: true, show_in_directory: true, ...extra,
  });

  const profiles = [
    P('u-tim', 'Tim', 'Reeve', { role: 'admin', email: 'tim@example.com' }),
    P('u-brennan', 'Brennan', 'Cattani', { spouse_id: 'u-sarah' }),
    P('u-sarah', 'Sarah', 'Cattani', { spouse_id: 'u-brennan' }),
    P('u-mike', 'Mike', 'Olsen', { spouse_id: 'u-jen' }),
    P('u-jen', 'Jen', 'Olsen', { spouse_id: 'u-mike' }),
    P('u-grace', 'Grace', 'Lin', {}),
  ];

  // ── children (Brennan + Sarah's kids) ───────────────────────────────────────
  const children = [
    { id: 'c-noah', name: 'Noah Cattani', profile_id: 'u-brennan', gender: 'Male', birthday: '2014-03-02' },
    { id: 'c-ella', name: 'Ella Cattani', profile_id: 'u-brennan', gender: 'Female', birthday: '2016-09-21' },
  ];

  // ── teams (Sunday serving) ──────────────────────────────────────────────────
  const teams = [
    { id: 't-worship', name: 'Worship', is_sunday_serving: true, serving_order: 10, allow_children: false, allow_nonmembers: true, leader_id: 'u-brennan' },
    { id: 't-welcome', name: 'Welcome / Greeting', is_sunday_serving: true, serving_order: 20, allow_children: false, allow_nonmembers: true, leader_id: null },
    { id: 't-kids', name: 'Kids Ministry', is_sunday_serving: true, serving_order: 30, allow_children: true, allow_nonmembers: false, leader_id: 'u-sarah' },
    { id: 't-av', name: 'A/V & Sound', is_sunday_serving: true, serving_order: 40, allow_children: true, allow_nonmembers: true, leader_id: null },
  ];

  // ── existing team rosters (members already on teams) ────────────────────────
  let tmId = 0;
  const tm = (team_id, member_id, extra = {}) => ({
    id: `tmrow-${++tmId}`, team_id, member_id, role: 'member', member_type: 'member',
    child_id: null, nonmember_name: null, nonmember_email: null, joined_at: '2025-01-01T00:00:00Z', ...extra,
  });
  const team_members = [
    tm('t-worship', 'u-brennan', { role: 'leader' }),
    tm('t-worship', 'u-grace'),
    tm('t-welcome', 'u-sarah'),
    tm('t-welcome', 'u-mike'),
    tm('t-kids', 'u-sarah', { role: 'leader' }),
    tm('t-av', 'u-mike'),
    tm('t-av', 'u-jen'),
  ];

  // ── the scheduler's roster mock-ups ─────────────────────────────────────────
  const slot = (team_id, role, type, ids = {}) => ({ team_id, role, assignee_type: type, ...ids });

  const schedule_rosters = [
    {
      date: SUN1, title: 'Sunday Gathering', type: 'sunday', cancelled: false,
      slots: [
        slot('t-worship', 'Worship Lead', 'member', { assignee_id: 'u-brennan' }),
        slot('t-worship', 'Vocals', 'member', { assignee_id: 'u-grace' }),
        slot('t-welcome', 'Greeter', 'member', { assignee_id: 'u-sarah' }),
        slot('t-av', 'Sound + Slides', 'couple', { assignee_id: 'u-mike', assignee_id_b: 'u-jen' }),
        slot('t-kids', 'Kids Helper', 'child', { assignee_id: 'c-noah', child_name: 'Noah Cattani' }),
        slot('t-welcome', 'Coffee', 'guest', { guest_id: 'g-jordan' }),
      ],
    },
    {
      date: SUN2, title: 'Sunday Gathering', type: 'sunday', cancelled: false,
      slots: [
        slot('t-worship', 'Worship Lead', 'couple', { assignee_id: 'u-mike', assignee_id_b: 'u-jen' }),
        slot('t-welcome', 'Greeter', 'member', { assignee_id: 'u-brennan' }),
        slot('t-kids', 'Kids Helper', 'child', { assignee_id: 'c-ella', child_name: 'Ella Cattani' }),
        slot('t-kids', 'Kids Lead', 'member', { assignee_id: 'u-sarah' }),
      ],
    },
    { date: SUN3, title: 'Sunday Gathering', type: 'sunday', cancelled: false, slots: [] },
  ];

  // ── a one-off calendar event (welcome tab reads child slots from events) ────
  const events = [
    {
      id: 'ev-baptism', title: 'Baptism Sunday Setup', event_date: plusDays(SUN1, 0), event_time: '9:00 AM',
      slots: [
        slot('t-av', 'Camera', 'member', { assignee_id: 'u-mike' }),
        slot('t-kids', 'Kids Table', 'child', { assignee_id: 'c-ella', child_name: 'Ella Cattani' }),
      ],
    },
  ];

  // ── guests (non-member volunteers) ──────────────────────────────────────────
  const guests = [
    { id: 'g-jordan', name: 'Jordan Avery', email: 'jordan@example.com' },
  ];

  // ── in-portal notifications (as send-reminders would have inserted) ─────────
  const member_notifications = [
    {
      id: 'n-1', profile_id: 'u-sarah', type: 'child_scheduled',
      title: 'Noah is serving this week',
      body: 'Noah is scheduled for <strong>Kids Helper</strong> this Sunday.',
      child_id: 'c-noah', created_at: new Date(now.getTime() - 3600e3).toISOString(),
      read_at: null, dismissed_at: null,
    },
  ];

  // misc tables the dashboard touches (kept minimal)
  const admin_messages = [
    { id: 'm-1', title: 'Welcome to the new portal!', content: 'Glad you’re here.', type: 'announcement',
      target_audience: 'all', target_mc_id: null, target_team_id: null,
      published_at: new Date(now.getTime() - 86400e3).toISOString(), author_id: 'u-tim', pinned: true },
  ];
  const file_tree = [{ id: 1, tree: [] }];
  const schedule_templates = [{
    id: 'tpl-default', is_default: true,
    slots: teams.map(t => ({ role: t.name, team_id: t.id })),
  }];
  const portal_settings = [
    { key: 'reminder_day', value: '3' },   // Wednesday
    { key: 'reminder_hour', value: '9' },   // 9am
  ];
  const missional_communities = [];
  const schedule_log = [];
  const swap_tokens = [];
  const prayer_requests = [];

  return {
    meta: { SUN1, SUN2, SUN3, todayStr },
    db: {
      profiles, children, teams, team_members, schedule_rosters, events, guests,
      member_notifications, admin_messages, file_tree, schedule_templates,
      portal_settings, missional_communities, schedule_log, swap_tokens, prayer_requests,
    },
  };
}
