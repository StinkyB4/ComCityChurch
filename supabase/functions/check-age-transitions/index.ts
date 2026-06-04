/**
 * COMMISSIONED CITY CHURCH — CHECK-AGE-TRANSITIONS EDGE FUNCTION
 * Supabase Edge Function (Deno runtime)
 *
 * Runs daily via pg_cron to enforce the age-18 child transition policy:
 *
 *   Stage A — 7 days before 18th birthday
 *     • Inserts a dismissible notification into member_notifications for each parent
 *     • Emails each parent (and co-parent spouse) a 7-day heads-up
 *
 *   Stage B — On the 18th birthday
 *     • Emails each parent a membership invitation link to share with the child
 *     • Inserts a member_notifications record for each parent
 *     • Starts the 6-month membership window (records turned_18_at)
 *
 *   Stage C — 6 months after the 18th birthday (if child has not registered)
 *     • Emails all team leaders whose teams include the child as a volunteer
 *     • Inserts a member_notifications record for each parent
 *     • Marks the child as transitioned
 *
 * pg_cron setup (run once in Supabase SQL editor after deploying this function):
 *   SELECT cron.schedule(
 *     'check-age-transitions',
 *     '0 9 * * *',
 *     $$
 *       SELECT net.http_post(
 *         url     := 'https://lkmphayrithxkmhvfiep.supabase.co/functions/v1/check-age-transitions',
 *         headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}'::jsonb,
 *         body    := '{}'::jsonb
 *       )
 *     $$
 *   );
 *
 * Manual test: POST { "force": true } with the service-role Bearer token.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'admin@commissionedcity.church';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     || 'noreply@commissionedcity.church';
const SITE_URL       = Deno.env.get('SITE_URL')       || 'https://commissionedcity.church';
const SITE_NAME      = Deno.env.get('SITE_NAME')      || 'Commissioned City Church';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || '';
const SERVICE_KEY    = Deno.env.get('SERVICE_ROLE_KEY') || '';

/* ── Brand tokens (match send-email/index.ts) ────────────────────────────── */
const NAVY     = '#112E53';
const RED      = '#D5393B';
const CHARCOAL = '#30343B';
const LOGO_URL = SITE_URL + '/assets/logo.png';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ═══════════════════════════════════════════════════════════════════════════
   EMAIL DESIGN HELPERS  (mirrors send-email/index.ts)
   ═══════════════════════════════════════════════════════════════════════════ */

function emailOpen(preview = ''): string {
  const previewTag = preview
    ? '<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' + preview + '</span>'
    : '';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + previewTag
    + '</head><body style="margin:0;padding:0;background:#F4F5F7;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px;"><tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 2px 12px rgba(17,46,83,0.10);">'
    + '<tr><td style="background:' + NAVY + ';padding:28px 40px;text-align:center;">'
    + '<img src="' + LOGO_URL + '" alt="' + SITE_NAME + '" height="72" style="display:block;margin:0 auto 12px;border-radius:8px;background:#fff;padding:6px 10px;">'
    + '<p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">For the Good of the City &middot; For the Glory of Christ</p>'
    + '</td></tr>';
}

function emailClose(): string {
  return '<tr><td style="background:' + NAVY + ';padding:24px 40px;text-align:center;">'
    + '<p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.9);font-family:Arial,sans-serif;font-weight:bold;">' + SITE_NAME + '</p>'
    + '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;">205 Roseberry St, Winnipeg, MB R3J 1T3</p>'
    + '<p style="margin:0;font-size:12px;font-family:Arial,sans-serif;"><a href="mailto:' + ADMIN_EMAIL + '" style="color:rgba(255,255,255,0.6);text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

function emailBody(content: string): string {
  return '<tr><td style="padding:32px 40px;font-size:15px;color:' + CHARCOAL + ';line-height:1.75;font-family:Arial,Helvetica,sans-serif;">'
    + content
    + '</td></tr>';
}

function emailButton(label: string, url: string): string {
  return '<tr><td style="padding:8px 40px 28px;">'
    + '<a href="' + url + '" style="display:inline-block;background:' + RED + ';color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 28px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.02em;">'
    + label
    + '</a>'
    + '</td></tr>';
}

function emailEyebrow(text: string): string {
  return '<p style="margin:0 0 6px;font-size:12px;color:' + RED + ';text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">' + text + '</p>';
}

function emailHeading(text: string): string {
  return '<p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:' + NAVY + ';">' + text + '</p>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESEND DELIVERY
   ═══════════════════════════════════════════════════════════════════════════ */

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('[check-age-transitions] No RESEND_API_KEY — skipping:', subject, 'to', to);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    SITE_NAME + ' <' + FROM_EMAIL + '>',
      to:      [to],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error('[check-age-transitions] Resend error:', await res.text());
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function dateMinusYears(dateStr: string, years: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

function dateMinusMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

function dateAddMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function fmtDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ═══════════════════════════════════════════════════════════════════════════ */

type SupabaseClient = ReturnType<typeof createClient>;

type ParentProfile = {
  id:         string;
  email:      string;
  first_name: string | null;
  full_name:  string | null;
  spouse_id:  string | null;
};

type ChildRow = {
  id:               string;
  name:             string;
  birthday:         string;
  profile_id:       string;
  transition_state: string;
  turned_18_at:     string | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: fetch parent + co-parent (spouse) profiles
   ═══════════════════════════════════════════════════════════════════════════ */

async function getParentProfiles(sb: SupabaseClient, profileId: string): Promise<ParentProfile[]> {
  const { data: parent } = await sb
    .from('profiles')
    .select('id, email, first_name, full_name, spouse_id')
    .eq('id', profileId)
    .single();

  if (!parent) return [];
  const parents: ParentProfile[] = [parent as ParentProfile];

  if ((parent as ParentProfile).spouse_id) {
    const { data: spouse } = await sb
      .from('profiles')
      .select('id, email, first_name, full_name, spouse_id')
      .eq('id', (parent as ParentProfile).spouse_id!)
      .single();
    if (spouse) parents.push(spouse as ParentProfile);
  }

  return parents;
}

function parentFirstName(p: ParentProfile): string {
  return p.first_name || (p.full_name || '').split(' ')[0] || 'Member';
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: insert a member_notification row (service role, bypasses RLS)
   ═══════════════════════════════════════════════════════════════════════════ */

async function insertNotification(
  sb:        SupabaseClient,
  profileId: string,
  type:      string,
  title:     string,
  body:      string,
  childId:   string,
): Promise<void> {
  const { error } = await sb.from('member_notifications').insert({
    profile_id: profileId,
    type,
    title,
    body,
    child_id:   childId,
  });
  if (error) console.error('[check-age-transitions] notification insert error:', error.message);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: naive name-match to detect if a child has registered as a member
   Returns true if a profile with a matching full_name exists (approved status).
   ═══════════════════════════════════════════════════════════════════════════ */

async function childHasRegistered(sb: SupabaseClient, childName: string): Promise<boolean> {
  const { data } = await sb
    .from('profiles')
    .select('id')
    .ilike('full_name', childName.trim())
    .eq('status', 'approved')
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAGE A — 7-day warning
   ═══════════════════════════════════════════════════════════════════════════ */

async function processSevenDayWarnings(sb: SupabaseClient, today: string): Promise<number> {
  // Find children whose birthday falls exactly 18 years before (today + 7 days)
  const targetBirthday = dateMinusYears(dateAddDays(today, 7), 18);

  const { data: children, error } = await sb
    .from('children')
    .select('id, name, birthday, profile_id, transition_state, turned_18_at')
    .eq('birthday', targetBirthday)
    .eq('transition_state', 'none');

  if (error) { console.error('[stage-A] query error:', error.message); return 0; }
  if (!children || children.length === 0) return 0;

  let count = 0;
  for (const child of children as ChildRow[]) {
    const parents = await getParentProfiles(sb, child.profile_id);
    const birthdayDisplay  = fmtDisplayDate(child.birthday);
    const deadlineDisplay  = fmtDisplayDate(dateAddMonths(child.birthday, 18 * 12)); // 18 yrs + 6 mo
    // Calculate 6-month deadline from birthday
    const sixMonthDeadline = fmtDisplayDate(dateAddMonths(dateAddDays(today, 7), 6));

    for (const parent of parents) {
      const firstName = parentFirstName(parent);

      // In-portal notification
      await insertNotification(
        sb,
        parent.id,
        'child_turning_18_7d',
        child.name + ' turns 18 in one week',
        '<strong>' + child.name + '</strong> turns 18 on <strong>' + birthdayDisplay + '</strong>. '
          + 'After their birthday they will no longer be listed under your account. '
          + 'We\'ll send you a registration link to share with them — they\'ll have until '
          + '<strong>' + sixMonthDeadline + '</strong> to create their own member account.',
        child.id,
      );

      // Email
      const regUrl  = SITE_URL + '/members/register.html';
      const dashUrl = SITE_URL + '/members/dashboard.html';
      const html    = emailOpen(child.name + ' turns 18 in one week')
        + emailBody(
            emailEyebrow('Family Update')
            + emailHeading(child.name + ' is Almost 18')
            + '<p style="margin:0 0 16px;">Hi <strong>' + firstName + '</strong>,</p>'
            + '<p style="margin:0 0 16px;">Just a heads-up — your child, <strong>' + child.name + '</strong>, will turn 18 one week from today (<strong>' + birthdayDisplay + '</strong>).</p>'
            + '<p style="margin:0 0 8px;">Here\'s what that means for the member portal:</p>'
            + '<ul style="margin:0 0 20px;padding-left:20px;line-height:1.9;color:' + CHARCOAL + ';font-size:14px;">'
            + '<li><strong>' + child.name + '</strong> will no longer be listed as a child under your account after their birthday.</li>'
            + '<li>They will have a <strong>6-month window</strong> (until <strong>' + sixMonthDeadline + '</strong>) to create their own member account.</li>'
            + '<li>If they haven\'t registered after 6 months and they serve on any teams, team leaders will be asked to update their volunteer status.</li>'
            + '</ul>'
            + '<p style="margin:0 0 16px;font-size:13px;color:#666;">There is nothing you need to do right now. We\'ll send you a registration link to share with ' + child.name + ' on their birthday.</p>'
            + '<p style="margin:0;font-size:13px;color:#777;">Questions? Reply to this email or contact us at <a href="mailto:' + ADMIN_EMAIL + '" style="color:' + RED + ';text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
          )
        + emailButton('Go to Member Portal', dashUrl)
        + emailClose();

      await sendEmail(
        parent.email,
        '[' + SITE_NAME + '] ' + child.name + ' turns 18 in one week',
        html,
      );
    }

    // Advance state so this child is not re-processed
    await sb.from('children')
      .update({ transition_state: 'warned_7d' })
      .eq('id', child.id);

    count++;
  }

  console.log('[stage-A] Processed ' + count + ' child(ren) for 7-day warning (birthday target: ' + targetBirthday + ')');
  return count;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAGE B — 18th birthday
   ═══════════════════════════════════════════════════════════════════════════ */

async function processEighteenthBirthdays(sb: SupabaseClient, today: string): Promise<number> {
  // Birthday stored as absolute date; child turns 18 when birthday == (today - 18 years)
  const targetBirthday = dateMinusYears(today, 18);

  const { data: children, error } = await sb
    .from('children')
    .select('id, name, birthday, profile_id, transition_state, turned_18_at')
    .eq('birthday', targetBirthday)
    .in('transition_state', ['none', 'warned_7d']); // catch both paths

  if (error) { console.error('[stage-B] query error:', error.message); return 0; }
  if (!children || children.length === 0) return 0;

  let count = 0;
  for (const child of children as ChildRow[]) {
    const parents          = await getParentProfiles(sb, child.profile_id);
    const birthdayDisplay  = fmtDisplayDate(child.birthday);
    const sixMonthDeadline = fmtDisplayDate(dateAddMonths(today, 6));
    const regUrl           = SITE_URL + '/members/register.html';
    const dashUrl          = SITE_URL + '/members/dashboard.html';

    for (const parent of parents) {
      const firstName = parentFirstName(parent);

      // In-portal notification
      await insertNotification(
        sb,
        parent.id,
        'child_turned_18',
        'Happy 18th Birthday, ' + child.name + '!',
        '<strong>' + child.name + '</strong> turns 18 today. Please share the member registration link with them — '
          + 'they have until <strong>' + sixMonthDeadline + '</strong> to create their own account. '
          + 'After that date, if they haven\'t registered and they serve on a team, team leaders will be notified.',
        child.id,
      );

      // Email
      const html = emailOpen('Happy 18th Birthday, ' + child.name + '!')
        + emailBody(
            emailEyebrow('Family Update')
            + emailHeading('Happy Birthday, ' + child.name + '!')
            + '<p style="margin:0 0 16px;">Hi <strong>' + firstName + '</strong>,</p>'
            + '<p style="margin:0 0 16px;">Today is <strong>' + child.name + '\'s 18th birthday</strong> — congratulations to your family!</p>'
            + '<p style="margin:0 0 16px;">As of today, ' + child.name + ' is eligible to create their own member account on the ' + SITE_NAME + ' portal. Please share the registration link below with them.</p>'
            + '<div style="background:#F4F5F7;border-left:4px solid ' + NAVY + ';border-radius:6px;padding:16px 20px;margin:0 0 20px;">'
            + '<p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:' + NAVY + ';">Registration deadline</p>'
            + '<p style="margin:0;font-size:15px;color:' + CHARCOAL + ';">' + sixMonthDeadline + '</p>'
            + '</div>'
            + '<p style="margin:0 0 8px;font-size:13px;color:#666;">If ' + child.name + ' has not registered by that date and they serve on any of our volunteer teams, team leaders will be asked to update their volunteer listing.</p>'
            + '<p style="margin:0;font-size:13px;color:#777;">Questions? Reply to this email or contact us at <a href="mailto:' + ADMIN_EMAIL + '" style="color:' + RED + ';text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
          )
        + emailButton('Share Registration Link', regUrl)
        + emailClose();

      await sendEmail(
        parent.email,
        '[' + SITE_NAME + '] Happy 18th Birthday, ' + child.name + '! — Registration Link Inside',
        html,
      );
    }

    // Record birthday and advance state
    await sb.from('children')
      .update({ transition_state: 'turned_18', turned_18_at: today })
      .eq('id', child.id);

    count++;
  }

  console.log('[stage-B] Processed ' + count + ' child(ren) turning 18 today (birthday target: ' + targetBirthday + ')');
  return count;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAGE C — 6-month expiry
   ═══════════════════════════════════════════════════════════════════════════ */

async function processSixMonthExpirations(sb: SupabaseClient, today: string): Promise<number> {
  const sixMonthsAgo = dateMinusMonths(today, 6);

  const { data: children, error } = await sb
    .from('children')
    .select('id, name, birthday, profile_id, transition_state, turned_18_at')
    .eq('transition_state', 'turned_18')
    .lte('turned_18_at', sixMonthsAgo);

  if (error) { console.error('[stage-C] query error:', error.message); return 0; }
  if (!children || children.length === 0) return 0;

  let count = 0;
  for (const child of children as ChildRow[]) {
    // Check whether the child has already registered as a member (name heuristic)
    const registered = await childHasRegistered(sb, child.name);

    if (registered) {
      // Child registered — mark transitioned silently, no leader notification needed
      await sb.from('children')
        .update({ transition_state: 'transitioned', transitioned_at: new Date().toISOString() })
        .eq('id', child.id);
      count++;
      continue;
    }

    // Find teams where this child is an active volunteer
    const { data: teamRows } = await sb
      .from('team_members')
      .select('team_id, teams(id, name, leader_id)')
      .eq('child_id', child.id)
      .eq('member_type', 'child');

    // Notify each unique team leader
    const notifiedLeaders = new Set<string>();
    for (const row of (teamRows || []) as Array<{ team_id: string; teams: { id: string; name: string; leader_id: string | null } | null }>) {
      const team = row.teams;
      if (!team?.leader_id || notifiedLeaders.has(team.leader_id)) continue;
      notifiedLeaders.add(team.leader_id);

      const { data: leader } = await sb
        .from('profiles')
        .select('id, email, first_name, full_name')
        .eq('id', team.leader_id)
        .single();

      if (!leader || !(leader as { email: string }).email) continue;

      const leaderFirst = (leader as { first_name: string | null; full_name: string | null }).first_name
        || ((leader as { full_name: string | null }).full_name || '').split(' ')[0]
        || 'Leader';

      const dashUrl = SITE_URL + '/members/dashboard.html?tab=teams';
      const html = emailOpen('Action required: ' + child.name + ' on ' + team.name)
        + emailBody(
            emailEyebrow('Team Leadership Notice')
            + emailHeading('Volunteer Status Update Required')
            + '<p style="margin:0 0 16px;">Hi <strong>' + leaderFirst + '</strong>,</p>'
            + '<p style="margin:0 0 16px;">This is a notice regarding a volunteer on your <strong>' + team.name + '</strong> team.</p>'
            + '<div style="background:#F4F5F7;border-left:4px solid ' + RED + ';border-radius:6px;padding:16px 20px;margin:0 0 20px;">'
            + '<p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:' + NAVY + ';">' + child.name + '</p>'
            + '<p style="margin:0;font-size:13px;color:' + CHARCOAL + ';">Previously listed as a child volunteer — turned 18 more than 6 months ago and has not yet registered as a member.</p>'
            + '</div>'
            + '<p style="margin:0 0 8px;">Please update their status in the team roster:</p>'
            + '<ol style="margin:0 0 20px;padding-left:20px;line-height:2;font-size:14px;color:' + CHARCOAL + ';">'
            + '<li>Go to the <strong>Teams</strong> tab in your portal dashboard</li>'
            + '<li>Find the <strong>' + team.name + '</strong> team</li>'
            + '<li>Remove <strong>' + child.name + '</strong> from the children section</li>'
            + '<li>Re-add them as a <strong>Non-Member Volunteer</strong> with their name and email address</li>'
            + '</ol>'
            + '<p style="margin:0;font-size:13px;color:#777;">If they have already created a member account, simply add them as a regular member instead. Questions? Contact us at <a href="mailto:' + ADMIN_EMAIL + '" style="color:' + RED + ';text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
          )
        + emailButton('Go to My Teams', dashUrl)
        + emailClose();

      await sendEmail(
        (leader as { email: string }).email,
        '[' + SITE_NAME + '] Action Required — ' + child.name + ' needs to be listed as a non-member on ' + team.name,
        html,
      );
    }

    // Notify parents that transition is complete
    const parents = await getParentProfiles(sb, child.profile_id);
    for (const parent of parents) {
      await insertNotification(
        sb,
        parent.id,
        'child_transitioned',
        child.name + ' has been removed from your account',
        '<strong>' + child.name + '</strong> has turned 18 and the 6-month membership window has closed. '
          + 'They have been removed from the children section of your account. '
          + 'If they still volunteer on a team, their team leader has been notified to update their status.',
        child.id,
      );
    }

    // Mark as fully transitioned
    await sb.from('children')
      .update({ transition_state: 'transitioned', transitioned_at: new Date().toISOString() })
      .eq('id', child.id);

    count++;
  }

  console.log('[stage-C] Processed ' + count + ' child(ren) past 6-month window (cutoff: ' + sixMonthsAgo + ')');
  return count;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════════════════════════ */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Supabase credentials not set' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty body from pg_cron */ }
  const force = body.force === true;

  const today = new Date().toISOString().split('T')[0];
  console.log('[check-age-transitions] Running for date:', today, force ? '(forced)' : '');

  const [countA, countB, countC] = await Promise.all([
    processSevenDayWarnings(sb, today),
    processEighteenthBirthdays(sb, today),
    processSixMonthExpirations(sb, today),
  ]);

  return new Response(
    JSON.stringify({ ok: true, date: today, warned: countA, turned18: countB, transitioned: countC }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
