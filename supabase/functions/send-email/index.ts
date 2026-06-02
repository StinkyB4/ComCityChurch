/**
 * COMMISSIONED CITY CHURCH — SEND EMAIL EDGE FUNCTION
 * Supabase Edge Function (Deno runtime)
 *
 * Handles all transactional email types for the members portal.
 * Uses Resend (https://resend.com) for delivery.
 * Design matches the Commissioned City Church website (navy + red).
 *
 * Required secrets (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY     — from resend.com
 *   ADMIN_EMAIL        — e.g. admin@commissionedcity.church
 *   SITE_URL           — e.g. https://commissionedcity.church
 *   SITE_NAME          — e.g. Commissioned City Church
 *   SERVICE_ROLE_KEY   — from Supabase → Project Settings → API
 *
 * Supported actions:
 *   registration_admin   — notify admin of new registration
 *   account_pending      — confirm pending status to new user
 *   account_approved     — welcome email to newly approved member
 *   spouse_linked        — notify spouse + CC admin
 *   spouse_invite        — invite non-member spouse to register
 *   message_notification — broadcast admin message to members
 *   weekly_church_email  — all-church weekly email (BCC)
 *   special_email        — ad-hoc email to custom recipient list
 *   event_assignment     — notify all assigned members/guests for a schedule event
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'admin@commissionedcity.church';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     || 'noreply@commissionedcity.church';
const SITE_URL       = Deno.env.get('SITE_URL')       || 'https://commissionedcity.church';
const SITE_NAME      = Deno.env.get('SITE_NAME')      || 'Commissioned City Church';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || '';
const SERVICE_KEY    = Deno.env.get('SERVICE_ROLE_KEY') || '';

/* ── Brand tokens (match styles.css) ─────────────────────── */
const NAVY     = '#112E53';
const RED      = '#D5393B';
const CHARCOAL = '#30343B';
const LOGO_URL = SITE_URL + '/assets/logo.png';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ════════════════════════════════════════════════════════════
   EMAIL DESIGN HELPERS
   ════════════════════════════════════════════════════════════ */

function emailOpen(preview: string = ''): string {
  const previewTag = preview
    ? '<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' + preview + '</span>'
    : '';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + previewTag
    + '</head><body style="margin:0;padding:0;background:#F4F5F7;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px;"><tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 2px 12px rgba(17,46,83,0.10);">'
    /* Header */
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

function emailDivider(): string {
  return '<tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #E8ECF0;margin:0;"></td></tr>';
}

function emailEyebrow(text: string): string {
  return '<p style="margin:0 0 6px;font-size:12px;color:' + RED + ';text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">' + text + '</p>';
}

function emailHeading(text: string): string {
  return '<p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:' + NAVY + ';">' + text + '</p>';
}

/* ════════════════════════════════════════════════════════════
   SEND VIA RESEND
   ════════════════════════════════════════════════════════════ */

async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  opts?: { bcc?: string[] }
) {
  if (!RESEND_API_KEY) {
    console.log('[send-email] No API key — simulating:', subject);
    return { ok: true, simulated: true };
  }

  const body: Record<string, unknown> = {
    from: SITE_NAME + ' <' + FROM_EMAIL + '>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (opts && opts.bcc && opts.bcc.length) body.bcc = opts.bcc;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[send-email] Resend error:', err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

/* ════════════════════════════════════════════════════════════
   SUPABASE ADMIN CLIENT
   ════════════════════════════════════════════════════════════ */

function getAdminSb() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/* ════════════════════════════════════════════════════════════
   EMAIL HANDLERS
   ════════════════════════════════════════════════════════════ */

async function handleRegistrationAdmin(payload: Record<string, unknown>) {
  const full_name   = String(payload.full_name   || '');
  const email       = String(payload.email       || '');
  const phone1_type = String(payload.phone1_type || 'Cell');
  const phone1      = String(payload.phone1      || '');
  const address     = String(payload.address     || '');
  const birthday    = String(payload.birthday    || '');
  const dashUrl     = SITE_URL + '/members/dashboard.html?tab=welcome';

  let rows = '<tr><td style="padding:6px 0;font-weight:bold;color:' + NAVY + ';width:110px;font-size:13px;">Name</td><td style="padding:6px 0;font-size:13px;color:' + CHARCOAL + ';">' + full_name + '</td></tr>';
  rows    += '<tr><td style="padding:6px 0;font-weight:bold;color:' + NAVY + ';font-size:13px;">Email</td><td style="padding:6px 0;font-size:13px;color:' + CHARCOAL + ';">' + email + '</td></tr>';
  if (phone1)   rows += '<tr><td style="padding:6px 0;font-weight:bold;color:' + NAVY + ';font-size:13px;">' + phone1_type + '</td><td style="padding:6px 0;font-size:13px;color:' + CHARCOAL + ';">' + phone1 + '</td></tr>';
  if (address)  rows += '<tr><td style="padding:6px 0;font-weight:bold;color:' + NAVY + ';font-size:13px;">Address</td><td style="padding:6px 0;font-size:13px;color:' + CHARCOAL + ';">' + address + '</td></tr>';
  if (birthday) rows += '<tr><td style="padding:6px 0;font-weight:bold;color:' + NAVY + ';font-size:13px;">Birthday</td><td style="padding:6px 0;font-size:13px;color:' + CHARCOAL + ';">' + birthday + '</td></tr>';

  const html = emailOpen('New member registration — action required')
    + emailBody(
        emailEyebrow('Action Required')
        + emailHeading('New Member Registration')
        + '<p style="margin:0 0 20px;color:' + CHARCOAL + ';">A new member account is awaiting your approval:</p>'
        + '<div style="background:#F4F5F7;border-left:4px solid ' + NAVY + ';border-radius:6px;padding:16px 20px;margin-bottom:8px;">'
        + '<table cellpadding="0" cellspacing="0" style="width:100%;">' + rows + '</table>'
        + '</div>'
      )
    + emailButton('Review & Approve on Dashboard', dashUrl)
    + emailClose();

  return sendEmail(ADMIN_EMAIL, '[' + SITE_NAME + '] New Member Registration: ' + full_name, html);
}

async function handleAccountPending(payload: Record<string, unknown>) {
  const first_name = String(payload.first_name || '');
  const email      = String(payload.email      || '');

  const siteUrl = SITE_URL || 'https://commissionedcity.church';
  const html = emailOpen('Your account is being reviewed — ' + SITE_NAME)
    + emailBody(
        emailEyebrow('Member Portal')
        + emailHeading('Thanks for Joining!')
        + '<p style="margin:0 0 16px;">Hi <strong>' + first_name + '</strong>,</p>'
        + '<p style="margin:0 0 16px;">Thank you for creating your ' + SITE_NAME + ' member account. Your registration is currently being reviewed by our admin team for approval &mdash; we&rsquo;re excited to have you!</p>'
        + '<p style="margin:0 0 24px;">We&rsquo;ll send you another email as soon as your account is approved. In the meantime, feel free to listen to some of our past sermons.</p>'
        + '<p style="margin:0;font-size:13px;color:#777;">Questions? Reach us at <a href="mailto:' + ADMIN_EMAIL + '" style="color:' + RED + ';text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
      )
    + emailButton('Listen to Past Sermons', siteUrl + '/sermons.html')
    + emailClose();

  return sendEmail(email, 'Welcome to ' + SITE_NAME + ' — Account Under Review', html);
}

async function handleAccountApproved(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };
  const { data: prof } = await sb.from('profiles').select('first_name,full_name,email').eq('id', String(payload.user_id || '')).single();
  if (!prof) return { ok: false, error: 'Profile not found' };
  const firstName = prof.first_name || (prof.full_name || '').split(' ')[0] || 'Member';
  const dashUrl   = SITE_URL + '/members/dashboard.html';

  const html = emailOpen('Welcome — your account has been approved')
    + emailBody(
        emailEyebrow('Member Portal')
        + emailHeading('Welcome to the Family!')
        + '<p style="margin:0 0 16px;">Hi <strong>' + firstName + '</strong>,</p>'
        + '<p style="margin:0 0 24px;">Your account has been approved! You now have full access to the ' + SITE_NAME + ' member portal &mdash; the directory, schedule, files, and more.</p>'
      )
    + emailButton('Access My Dashboard', dashUrl)
    + emailClose();

  return sendEmail(prof.email, 'Welcome to ' + SITE_NAME + ' — Your Account is Approved', html);
}

async function handleSpouseLinked(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };
  const [{ data: linker }, { data: spouse }] = await Promise.all([
    sb.from('profiles').select('first_name,last_name,full_name,email').eq('id', String(payload.linker_id || '')).single(),
    sb.from('profiles').select('first_name,full_name,email').eq('id', String(payload.spouse_id || '')).single(),
  ]);
  if (!linker || !spouse) return { ok: false, error: 'Profile not found' };
  const linkerName  = (linker.first_name + ' ' + (linker.last_name || '')).trim() || linker.full_name || '';
  const spouseFirst = spouse.first_name || (spouse.full_name || '').split(' ')[0] || 'Member';

  const html = emailOpen()
    + emailBody(
        emailEyebrow('Member Portal')
        + emailHeading('Family Profiles Linked')
        + '<p style="margin:0 0 16px;">Hi <strong>' + spouseFirst + '</strong>,</p>'
        + '<p style="margin:0 0 16px;"><strong>' + linkerName + '</strong> has indicated on the ' + SITE_NAME + ' member portal that you are married. Your profiles have been linked as a family in the member directory.</p>'
        + '<p style="margin:0;font-size:13px;color:#777;">If this was done in error, simply reply to this email and we\'ll correct it right away.</p>'
      )
    + emailClose();

  await sendEmail(spouse.email, SITE_NAME + ' — Family Profiles Linked', html);
  return sendEmail(ADMIN_EMAIL, '[' + SITE_NAME + '] Family Link: ' + linkerName + ' & ' + spouseFirst, html);
}

async function handleSpouseInvite(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };
  const { data: inv } = await sb.from('profiles').select('first_name,last_name,full_name').eq('id', String(payload.inviter_id || '')).single();
  if (!inv) return { ok: false, error: 'Inviter not found' };
  const inviterName  = (inv.first_name + ' ' + (inv.last_name || '')).trim() || inv.full_name || '';
  const inviteeEmail = String(payload.invitee_email || '');
  const regUrl       = SITE_URL + '/members/register.html';

  const html = emailOpen()
    + emailBody(
        emailEyebrow('Member Portal')
        + emailHeading('You\'re Invited!')
        + '<p style="margin:0 0 16px;">Hi,</p>'
        + '<p style="margin:0 0 16px;"><strong>' + inviterName + '</strong> has registered on the ' + SITE_NAME + ' member portal and indicated that you are their spouse.</p>'
        + '<p style="margin:0 0 24px;">They\'d love for you to create your own account so your family can be connected in the member directory. It only takes a few minutes.</p>'
      )
    + emailButton('Create My Member Account', regUrl)
    + emailClose();

  return sendEmail(inviteeEmail, inviterName + ' has invited you to join the ' + SITE_NAME + ' member portal', html);
}

async function handleMessageNotification(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };
  const title       = String(payload.title       || '');
  const msgBody     = String(payload.body        || '').slice(0, 500);
  const date        = String(payload.date        || '');
  const targetType  = String(payload.target_type || 'all');   // 'all' | 'mc' | 'team'
  const targetId    = String(payload.target_id   || '');
  const dashUrl     = SITE_URL + '/members/dashboard.html';

  /* ── Resolve recipients based on target type ── */
  let members: Array<{ first_name: string; full_name: string; email: string }> = [];
  let groupLabel = '';

  if (targetType === 'mc' && targetId) {
    /* fetch MC name for subject line */
    const { data: mc } = await sb.from('missional_communities').select('name').eq('id', targetId).single();
    groupLabel = mc ? mc.name + ' MC' : 'your Missional Community';
    /* fetch members whose preferred_community matches */
    const { data: mems } = await sb
      .from('profiles')
      .select('first_name,full_name,email')
      .eq('status', 'approved')
      .eq('preferred_community', targetId);
    members = mems || [];

  } else if (targetType === 'team' && targetId) {
    /* fetch team name for subject line */
    const { data: team } = await sb.from('teams').select('name').eq('id', targetId).single();
    groupLabel = team ? team.name + ' Team' : 'your Team';
    /* fetch team members via join */
    const { data: tmRows } = await sb
      .from('team_members')
      .select('profiles(first_name,full_name,email)')
      .eq('team_id', targetId);
    members = (tmRows || [])
      .map((r: Record<string, unknown>) => r.profiles as { first_name: string; full_name: string; email: string })
      .filter(Boolean);

  } else {
    /* default: all approved members */
    const { data: mems } = await sb.from('profiles').select('first_name,full_name,email').eq('status', 'approved');
    members = mems || [];
    groupLabel = '';
  }

  if (!members.length) return { ok: true, note: 'No recipients found for target' };

  const subjectPrefix = groupLabel ? '[' + SITE_NAME + ' · ' + groupLabel + '] ' : '[' + SITE_NAME + '] ';

  for (const m of members) {
    const firstName = m.first_name || (m.full_name || '').split(' ')[0] || 'Member';
    const dateRow   = date
      ? '<p style="margin:0 0 8px;font-size:11px;color:' + RED + ';text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">' + date + '</p>'
      : '';
    const groupRow  = groupLabel
      ? '<p style="margin:0 0 4px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.08em;">Message for: ' + groupLabel + '</p>'
      : '';
    const html = emailOpen('New message from ' + SITE_NAME)
      + emailBody(
          '<p style="margin:0 0 16px;">Hi <strong>' + firstName + '</strong>,</p>'
          + '<div style="background:#F4F5F7;border-left:4px solid ' + NAVY + ';border-radius:6px;padding:20px 24px;margin-bottom:24px;">'
          + groupRow
          + dateRow
          + '<p style="margin:0 0 10px;font-size:17px;font-weight:bold;color:' + NAVY + ';">' + title + '</p>'
          + '<p style="margin:0;color:' + CHARCOAL + ';font-size:14px;line-height:1.7;">' + msgBody + '</p>'
          + '</div>'
        )
      + emailButton('View on Dashboard', dashUrl)
      + emailClose();
    await sendEmail(m.email, subjectPrefix + title, html);
  }
  return { ok: true, sent: members.length };
}

async function handleWeeklyChurchEmail(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };
  const subject       = String(payload.subject     || '');
  const emailBodyHtml = String(payload.body         || '');
  const roster_date   = String(payload.roster_date  || '');

  let recipList: string[] = [];
  if (Array.isArray(payload.recipients) && payload.recipients.length) {
    recipList = payload.recipients as string[];
  } else {
    const { data: mems } = await sb.from('profiles').select('email').eq('status', 'approved');
    recipList = (mems || []).map((m: { email: string }) => m.email);
  }
  if (!recipList.length) return { ok: true, note: 'No recipients' };

  let scheduleRows = '';
  if (roster_date) {
    const { data: roster } = await sb.from('schedule_rosters').select('*').eq('date', roster_date).single();
    if (roster && Array.isArray(roster.slots) && roster.slots.length) {
      for (const slot of roster.slots as Array<Record<string, string>>) {
        const assignee = slot.assignee_type ? '(assigned)' : 'TBD';
        scheduleRows += '<tr>'
          + '<td style="padding:9px 16px 9px 0;font-size:14px;color:#777;width:45%;border-bottom:1px solid #E8ECF0;">' + (slot.role || '') + '</td>'
          + '<td style="padding:9px 0;font-size:14px;color:' + CHARCOAL + ';font-weight:bold;border-bottom:1px solid #E8ECF0;">' + assignee + '</td>'
          + '</tr>';
      }
    }
  }

  let scheduleSection = '';
  if (scheduleRows) {
    scheduleSection = '<tr><td style="padding:0 40px 24px;">'
      + '<p style="margin:0 0 12px;font-size:12px;color:' + RED + ';text-transform:uppercase;letter-spacing:0.08em;font-weight:bold;">Serving This Sunday</p>'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
      + scheduleRows
      + '</table></td></tr>';
  }

  const html = emailOpen('This week at ' + SITE_NAME)
    + '<tr><td style="padding:32px 40px 16px;font-size:15px;color:' + CHARCOAL + ';line-height:1.75;font-family:Arial,Helvetica,sans-serif;">' + emailBodyHtml + '</td></tr>'
    + (scheduleRows ? emailDivider() : '')
    + scheduleSection
    + emailClose();

  return sendEmail(ADMIN_EMAIL, subject, html, { bcc: recipList });
}

async function handleSpecialEmail(payload: Record<string, unknown>) {
  const subject       = String(payload.subject || '');
  const emailBodyHtml = String(payload.body    || '');
  if (!Array.isArray(payload.recipients) || !payload.recipients.length) {
    return { ok: false, error: 'No recipients' };
  }
  const recipients = payload.recipients as string[];
  const html = emailOpen()
    + '<tr><td style="padding:32px 40px;font-size:15px;color:' + CHARCOAL + ';line-height:1.75;font-family:Arial,Helvetica,sans-serif;">' + emailBodyHtml + '</td></tr>'
    + emailClose();
  return sendEmail(ADMIN_EMAIL, subject, html, { bcc: recipients });
}

async function handleEventAssignment(payload: Record<string, unknown>) {
  const sb = getAdminSb();
  if (!sb) return { ok: false, error: 'No admin client' };

  const eventTitle = String(payload.event_title || 'Sunday Service');
  const eventDate  = String(payload.event_date  || '');
  const eventTime  = String(payload.event_time  || '');
  const slots      = Array.isArray(payload.slots) ? payload.slots as Array<Record<string, unknown>> : [];

  if (!slots.length) return { ok: true, note: 'No slots' };

  const displayDate = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  const profileIds = new Set<string>();
  const guestIds   = new Set<string>();
  for (const slot of slots) {
    const atype = String(slot.assignee_type || '');
    if ((atype === 'member' || atype === 'couple') && slot.assignee_id)  profileIds.add(String(slot.assignee_id));
    if (atype === 'couple' && slot.assignee_id_b)                        profileIds.add(String(slot.assignee_id_b));
    if (atype === 'guest'  && slot.guest_id)                             guestIds.add(String(slot.guest_id));
  }

  type ProfRow  = { id: string; first_name: string; full_name: string; email: string };
  type GuestRow = { id: string; name: string; email: string };

  const [{ data: profiles }, { data: guests }] = await Promise.all([
    profileIds.size ? sb.from('profiles').select('id,first_name,full_name,email').in('id', [...profileIds]) : Promise.resolve({ data: [] }),
    guestIds.size   ? sb.from('guests').select('id,name,email').in('id', [...guestIds])                     : Promise.resolve({ data: [] }),
  ]);

  const profMap: Record<string, ProfRow> = {};
  (profiles || []).forEach((p: ProfRow) => { profMap[p.id] = p; });
  const guestMap: Record<string, GuestRow> = {};
  (guests || []).forEach((g: GuestRow) => { guestMap[g.id] = g; });

  const personRoles: Record<string, { firstName: string; roles: string[] }> = {};
  function addRole(email: string, firstName: string, role: string) {
    if (!email) return;
    if (!personRoles[email]) personRoles[email] = { firstName, roles: [] };
    if (role) personRoles[email].roles.push(role);
  }

  for (const slot of slots) {
    const atype = String(slot.assignee_type || '');
    const role  = String(slot.role || '');
    if (atype === 'member' && slot.assignee_id) {
      const p = profMap[String(slot.assignee_id)];
      if (p) addRole(p.email, p.first_name || (p.full_name || '').split(' ')[0], role);
    } else if (atype === 'couple') {
      for (const id of [String(slot.assignee_id || ''), String(slot.assignee_id_b || '')].filter(Boolean)) {
        const p = profMap[id];
        if (p) addRole(p.email, p.first_name || (p.full_name || '').split(' ')[0], role);
      }
    } else if (atype === 'guest' && slot.guest_id) {
      const g = guestMap[String(slot.guest_id)];
      if (g && g.email) addRole(g.email, g.name.split(' ')[0] || g.name, role);
    } else if (atype === 'guest_inline' && slot.guest_email) {
      const name = String(slot.guest_name || '');
      addRole(String(slot.guest_email), name.split(' ')[0] || name || 'Friend', role);
    }
  }

  const dashUrl = SITE_URL + '/members/dashboard.html?tab=schedule';
  let sentCount = 0;

  for (const [email, { firstName, roles }] of Object.entries(personRoles)) {
    const rolesText = roles.filter(Boolean).join(' & ') || 'Serving';
    const dateStr   = [displayDate, eventTime].filter(Boolean).join(' at ');

    const html = emailOpen('You\'re serving at ' + eventTitle)
      + emailBody(
          emailEyebrow('Serving Assignment')
          + emailHeading('You\'re on the schedule!')
          + '<p style="margin:0 0 16px;">Hi <strong>' + firstName + '</strong>,</p>'
          + '<p style="margin:0 0 16px;">You\'ve been scheduled for an upcoming ' + SITE_NAME + ' service:</p>'
          + '<div style="background:#F4F5F7;border-left:4px solid ' + NAVY + ';border-radius:6px;padding:16px 20px;margin-bottom:24px;">'
          + (dateStr ? '<p style="margin:0 0 8px;font-size:13px;color:' + RED + ';font-weight:bold;">' + dateStr + '</p>' : '')
          + '<p style="margin:0 0 4px;font-size:12px;color:#777;text-transform:uppercase;letter-spacing:0.06em;">' + eventTitle + '</p>'
          + '<p style="margin:0;font-size:17px;font-weight:bold;color:' + NAVY + ';">' + rolesText + '</p>'
          + '</div>'
          + '<p style="margin:0;font-size:13px;color:#777;">Questions? Reply to this email or reach us at <a href="mailto:' + ADMIN_EMAIL + '" style="color:' + RED + ';text-decoration:none;">' + ADMIN_EMAIL + '</a></p>'
        )
      + emailButton('View Schedule', dashUrl)
      + emailClose();

    await sendEmail(email, SITE_NAME + ' — You\'re serving: ' + rolesText + (displayDate ? ' (' + displayDate + ')' : ''), html);
    sentCount++;
  }

  return { ok: true, sent: sentCount };
}

/* ════════════════════════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════════════════════════ */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const payload = await req.json();
    const { action, ...rest } = payload;
    let result: unknown;

    switch (action) {
      case 'registration_admin':   result = await handleRegistrationAdmin(rest);   break;
      case 'account_pending':      result = await handleAccountPending(rest);      break;
      case 'account_approved':     result = await handleAccountApproved(rest);     break;
      case 'spouse_linked':        result = await handleSpouseLinked(rest);        break;
      case 'spouse_invite':        result = await handleSpouseInvite(rest);        break;
      case 'message_notification': result = await handleMessageNotification(rest); break;
      case 'weekly_church_email':  result = await handleWeeklyChurchEmail(rest);   break;
      case 'special_email':        result = await handleSpecialEmail(rest);        break;
      case 'event_assignment':     result = await handleEventAssignment(rest);     break;
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action: ' + action }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[send-email] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
