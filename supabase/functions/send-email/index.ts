/**
 * COMMISSIONED CITY CHURCH — SEND EMAIL EDGE FUNCTION
 * Supabase Edge Function (Deno runtime)
 *
 * Handles all 9 email types from the members portal.
 * Uses Resend (https://resend.com) for delivery.
 *
 * Setup:
 *   1. Set RESEND_API_KEY secret in Supabase dashboard
 *   2. Set ADMIN_EMAIL secret (default: info@commissionedcity.church)
 *   3. Set SITE_URL secret (e.g. https://commissionedcity.church)
 *   4. Set SITE_NAME secret (e.g. Commissioned City Church)
 *   5. Deploy: supabase functions deploy send-email
 *
 * Called via: supabase.functions.invoke('send-email', { body: { action, ...payload } })
 *
 * Supported actions:
 *   registration_admin  — notify admin of new registration
 *   account_pending     — confirm pending status to new user
 *   account_approved    — welcome email to newly approved member
 *   spouse_linked       — notify spouse + CC admin
 *   spouse_invite       — invite non-member spouse to register
 *   message_notification — broadcast admin message to members
 *   serving_reminder    — personalized Wednesday serving reminder
 *   weekly_church_email — all-church weekly email
 *   special_email       — ad-hoc email to custom list
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'info@commissionedcity.church';
const SITE_URL       = Deno.env.get('SITE_URL')       || 'https://commissionedcity.church';
const SITE_NAME      = Deno.env.get('SITE_NAME')      || 'Commissioned City Church';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const BRAND  = '#7a4a35';
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ─── HTML email shell ─────────────────────────────────────── */
function emailOpen(previewText = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${previewText ? `<span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>` : ''}
</head><body style="margin:0;padding:0;background:#f0ece8;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece8;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:${BRAND};padding:28px 40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:24px;font-weight:normal;letter-spacing:0.02em;">${SITE_NAME}</h1>
</td></tr>`;
}

function emailClose() {
  return `<tr><td style="background:#f9f6f4;padding:20px 40px;border-top:1px solid #e8e0db;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#aaa;">${SITE_NAME}</p>
<p style="margin:0;font-size:12px;color:#bbb;"><a href="mailto:${ADMIN_EMAIL}" style="color:#bbb;text-decoration:none;">${ADMIN_EMAIL}</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

function emailBody(content: string) {
  return `<tr><td style="padding:32px 40px;font-size:15px;color:#444;line-height:1.75;">${content}</td></tr>`;
}

function emailButton(label: string, url: string) {
  return `<tr><td style="padding:8px 40px 24px;">
<a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 24px;border-radius:6px;">${label}</a>
</td></tr>`;
}

/* ─── Send via Resend ─────────────────────────────────────── */
async function sendEmail(to: string | string[], subject: string, html: string, opts?: { cc?: string; bcc?: string[] }) {
  if (!RESEND_API_KEY) {
    console.log('[send-email] No RESEND_API_KEY — logging email instead:');
    console.log('To:', to, 'Subject:', subject);
    return { ok: true, simulated: true };
  }

  const body: Record<string, unknown> = {
    from: `${SITE_NAME} <${ADMIN_EMAIL}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (opts?.cc)  body.cc  = opts.cc;
  if (opts?.bcc) body.bcc = opts.bcc;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[send-email] Resend error:', err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

/* ─── Supabase admin client ───────────────────────────────── */
function getAdminSb() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/* ─── Email builders ─────────────────────────────────────── */

async function handleRegistrationAdmin(payload: Record<string, unknown>) {
  const { user_id, full_name, email, phone1_type, phone1, address, birthday } = payload;
  const dashUrl = `${SITE_URL}/members/dashboard.html?tab=welcome`;
  const html = emailOpen('New member registration — action required')
    + emailBody(`
      <p style="margin:0 0 20px;">A new member account is awaiting your approval.</p>
      <div style="background:#faf7f5;border-left:4px solid ${BRAND};border-radius:6px;padding:20px 24px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#444;">
          <tr><td style="padding:4px 0;font-weight:bold;width:120px;">Name</td><td>${full_name}</td></tr>
          <tr><td style="padding:4px 0;font-weight:bold;">Email</td><td>${email}</td></tr>
          ${phone1 ? `<tr><td style="padding:4px 0;font-weight:bold;">${phone1_type}</td><td>${phone1}</td></tr>` : ''}
          ${address ? `<tr><td style="padding:4px 0;font-weight:bold;">Address</td><td>${address}</td></tr>` : ''}
          ${birthday ? `<tr><td style="padding:4px 0;font-weight:bold;">Birthday</td><td>${birthday}</td></tr>` : ''}
        </table>
      </div>`)
    + emailButton('Review & Approve on Dashboard', dashUrl)
    + emailClose();
  return sendEmail(ADMIN_EMAIL, `[${SITE_NAME}] New Member Registration: ${full_name}`, html);
}

async function handleAccountPending(payload: Record<string, unknown>) {
  const { first_name, email } = payload;
  const html = emailOpen()
    + emailBody(`
      <p style="margin:0 0 16px;">Hi ${first_name},</p>
      <p style="margin:0 0 16px;">Thank you for registering with the ${SITE_NAME} member portal!</p>
      <p style="margin:0 0 24px;">Your account has been created and is currently <strong>pending approval</strong> by a site administrator. You will receive another email as soon as your account is approved, typically within one business day.</p>
      <p style="margin:0;font-size:13px;color:#aaa;">If you have any questions, contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:${BRAND};">${ADMIN_EMAIL}</a>.</p>`)
    + emailClose();
  return sendEmail(String(email), `Your ${SITE_NAME} Account is Pending Approval`, html);
}

async function handleAccountApproved(payload: Record<string, unknown>) {
  const sb = getAdminSb(); if (!sb) return { ok: false, error: 'No admin client' };
  const { user_id } = payload;
  const { data: prof } = await sb.from('profiles').select('first_name,full_name,email').eq('id', user_id).single();
  if (!prof) return { ok: false, error: 'Profile not found' };
  const firstName = prof.first_name || (prof.full_name || '').split(' ')[0] || 'Member';
  const dashUrl = `${SITE_URL}/members/dashboard.html`;
  const html = emailOpen()
    + emailBody(`
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 24px;">Your account has been approved! You can now log in to the ${SITE_NAME} member portal.</p>`)
    + emailButton('Access My Dashboard', dashUrl)
    + emailClose();
  return sendEmail(prof.email, `Welcome to ${SITE_NAME} — Your Account is Approved`, html);
}

async function handleSpouseLinked(payload: Record<string, unknown>) {
  const sb = getAdminSb(); if (!sb) return { ok: false, error: 'No admin client' };
  const { linker_id, spouse_id } = payload;
  const [{ data: linker }, { data: spouse }] = await Promise.all([
    sb.from('profiles').select('first_name,last_name,full_name,email').eq('id', linker_id).single(),
    sb.from('profiles').select('first_name,full_name,email').eq('id', spouse_id).single(),
  ]);
  if (!linker || !spouse) return { ok: false, error: 'Profile not found' };
  const linkerName  = `${linker.first_name || ''} ${linker.last_name || ''}`.trim() || linker.full_name || '';
  const spouseFirst = spouse.first_name || (spouse.full_name || '').split(' ')[0] || 'Member';
  const html = emailOpen()
    + emailBody(`
      <p style="margin:0 0 16px;">Hi ${spouseFirst},</p>
      <p style="margin:0 0 16px;">This is a courtesy notice that <strong>${linkerName}</strong> has indicated on the ${SITE_NAME} member portal that you are married. Your profiles have been linked as a family in the directory.</p>
      <p style="margin:0 0 24px;">If this was done in error, please reply to this email and we will correct it promptly.</p>
      <p style="margin:0;font-size:13px;color:#aaa;">Questions? Contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:${BRAND};">${ADMIN_EMAIL}</a>.</p>`)
    + emailClose();
  await sendEmail(spouse.email, `${SITE_NAME} — Family Profiles Linked`, html);
  return sendEmail(ADMIN_EMAIL, `[${SITE_NAME}] Family Link: ${linkerName} & ${spouseFirst}`, html);
}

async function handleSpouseInvite(payload: Record<string, unknown>) {
  const sb = getAdminSb(); if (!sb) return { ok: false, error: 'No admin client' };
  const { inviter_id, invitee_email } = payload;
  const { data: inv } = await sb.from('profiles').select('first_name,last_name,full_name').eq('id', inviter_id).single();
  if (!inv) return { ok: false, error: 'Inviter not found' };
  const inviterName  = `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || inv.full_name || '';
  const inviterFirst = inv.first_name || (inv.full_name || '').split(' ')[0] || '';
  const regUrl = `${SITE_URL}/members/register.html`;
  const html = emailOpen()
    + emailBody(`
      <p style="margin:0 0 16px;">Hi,</p>
      <p style="margin:0 0 16px;">You're receiving this message because <strong>${inviterName}</strong> has registered on the ${SITE_NAME} member portal and has indicated that you are their spouse.</p>
      <p style="margin:0 0 24px;">${inviterFirst} would like to invite you to create your own member account so your family can be connected in our directory.</p>`)
    + emailButton('Create My Member Account', regUrl)
    + emailClose();
  return sendEmail(String(invitee_email), `${inviterName} has invited you to join the ${SITE_NAME} member portal`, html);
}

async function handleMessageNotification(payload: Record<string, unknown>) {
  const sb = getAdminSb(); if (!sb) return { ok: false, error: 'No admin client' };
  const { title, body: msgBody, date } = payload;
  const { data: members } = await sb.from('profiles').select('first_name,full_name,email').eq('status','approved');
  if (!members || !members.length) return { ok: true, note: 'No approved members' };
  const dashUrl = `${SITE_URL}/members/dashboard.html`;
  for (const m of members) {
    const firstName = m.first_name || (m.full_name || '').split(' ')[0] || 'Member';
    const html = emailOpen(`New message from ${SITE_NAME}`)
      + emailBody(`
        <p style="margin:0 0 20px;">Hi ${firstName},</p>
        <div style="background:#faf7f5;border-left:4px solid ${BRAND};border-radius:6px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;">${date || ''}</p>
          <h2 style="margin:0 0 12px;font-size:18px;color:#333;">${title}</h2>
          <p style="margin:0;color:#555;font-size:14px;line-height:1.7;">${String(msgBody || '').slice(0, 300)}</p>
        </div>`)
      + emailButton('View on Dashboard', dashUrl)
      + emailClose();
    await sendEmail(m.email, `[${SITE_NAME}] New Message: ${title}`, html);
  }
  return { ok: true };
}

async function handleWeeklyChurchEmail(payload: Record<string, unknown>) {
  const sb = getAdminSb(); if (!sb) return { ok: false, error: 'No admin client' };
  const { subject, body: emailBodyHtml, roster_date, recipients } = payload;
  let recipList: string[] = [];
  if (Array.isArray(recipients) && recipients.length) {
    recipList = recipients as string[];
  } else {
    const { data: mems } = await sb.from('profiles').select('email').eq('status','approved');
    recipList = (mems || []).map((m: { email: string }) => m.email);
  }
  if (!recipList.length) return { ok: true, note: 'No recipients' };

  let scheduleHtml = '';
  if (roster_date) {
    const { data: roster } = await sb.from('schedule_rosters').select('*').eq('date', roster_date).single();
    if (roster && roster.slots && roster.slots.length) {
      scheduleHtml += `<tr><td style="background:${BRAND};padding:10px 40px;"><p style="margin:0;color:#fff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;">Serving This Sunday</p></td></tr>`;
      scheduleHtml += '<tr><td style="padding:0 40px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">';
      for (const slot of roster.slots) {
        scheduleHtml += `<tr style="background:#fff;"><td style="padding:9px 16px 9px 0;font-size:14px;color:#888;width:45%;border-bottom:1px solid #f0ebe8;">${slot.role || ''}</td><td style="padding:9px 0;font-size:14px;color:#333;font-weight:bold;border-bottom:1px solid #f0ebe8;">${slot.assignee_type ? '(assigned)' : '<span style="color:#ccc;font-weight:normal;">TBD</span>'}</td></tr>`;
      }
      scheduleHtml += '</table></td></tr>';
    }
  }

  const fullHtml = emailOpen(`This week at ${SITE_NAME}`)
    + `<tr><td style="padding:20px 40px;font-size:15px;color:#444;line-height:1.75;">${emailBodyHtml || ''}</td></tr>`
    + scheduleHtml
    + emailClose();

  /* send as BCC so recipients can't see each other */
  const result = await sendEmail(ADMIN_EMAIL, String(subject), fullHtml, { bcc: recipList });
  return result;
}

async function handleSpecialEmail(payload: Record<string, unknown>) {
  const { subject, body: emailBodyHtml, recipients } = payload;
  if (!Array.isArray(recipients) || !recipients.length) return { ok: false, error: 'No recipients' };
  const html = emailOpen()
    + `<tr><td style="padding:32px 40px;font-size:15px;color:#444;line-height:1.75;">${emailBodyHtml || ''}</td></tr>`
    + emailClose();
  return sendEmail(ADMIN_EMAIL, String(subject), html, { bcc: recipients as string[] });
}

/* ─── Router ──────────────────────────────────────────────── */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const payload = await req.json();
    const { action, ...rest } = payload;

    let result: unknown;
    switch (action) {
      case 'registration_admin':    result = await handleRegistrationAdmin(rest); break;
      case 'account_pending':       result = await handleAccountPending(rest);    break;
      case 'account_approved':      result = await handleAccountApproved(rest);   break;
      case 'spouse_linked':         result = await handleSpouseLinked(rest);      break;
      case 'spouse_invite':         result = await handleSpouseInvite(rest);      break;
      case 'message_notification':  result = await handleMessageNotification(rest); break;
      case 'weekly_church_email':   result = await handleWeeklyChurchEmail(rest); break;
      case 'special_email':         result = await handleSpecialEmail(rest);      break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-email] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
