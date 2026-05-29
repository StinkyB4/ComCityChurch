/**
 * SEND-REMINDERS EDGE FUNCTION
 * Sends personalized Wednesday serving reminder emails.
 * Called manually ("Send Reminders Now" button) or via pg_cron.
 *
 * pg_cron schedule (run in Supabase SQL editor):
 *   SELECT cron.schedule(
 *     'wed-reminders',
 *     '0 9 * * 3',   -- Every Wednesday at 9am UTC
 *     $$
 *       SELECT net.http_post(
 *         url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
 *         headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
 *         body := '{}'::jsonb
 *       )
 *     $$
 *   );
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'info@commissionedcity.church';
const SITE_URL       = Deno.env.get('SITE_URL')       || 'https://commissionedcity.church';
const SITE_NAME      = Deno.env.get('SITE_NAME')      || 'Commissioned City Church';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const BRAND = '#7a4a35';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function nextSunday(from: Date): string {
  const dow = from.getDay();
  const days = (dow === 0 && from.getHours() >= 12) ? 7 : ((7 - dow) % 7 === 0 ? 0 : (7 - dow) % 7);
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function sundayAfter(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
}

function emailOpen(preview = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
${preview ? `<span style="display:none;max-height:0;overflow:hidden;">${preview}</span>` : ''}
</head><body style="margin:0;padding:0;background:#f0ece8;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece8;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:${BRAND};padding:28px 40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:24px;font-weight:normal;">${SITE_NAME}</h1></td></tr>`;
}

function emailClose() {
  return `<tr><td style="background:#f9f6f4;padding:20px 40px;border-top:1px solid #e8e0db;text-align:center;">
<p style="margin:0;font-size:12px;color:#bbb;">${SITE_NAME} — <a href="mailto:${ADMIN_EMAIL}" style="color:#bbb;">${ADMIN_EMAIL}</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

function sectionHeader(label: string) {
  return `<tr><td style="background:${BRAND};padding:10px 40px;">
<p style="margin:0;color:#fff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;">${label}</p></td></tr>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.log('No RESEND_API_KEY — skipping:', subject, 'to', to); return; }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${SITE_NAME} <${ADMIN_EMAIL}>`, to: [to], subject, html }),
  });
}

async function buildSwapToken(sb: ReturnType<typeof createClient>, date: string, role: string, personName: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
  await sb.from('swap_tokens').insert({ token, date, role, person_name: personName, expires_at: expiresAt.toISOString() });
  return `${SITE_URL}/members/swap.html?token=${token}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase credentials not set' }), { status: 500, headers: CORS });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const thisDate = nextSunday(now);
  const nextDate = sundayAfter(thisDate);

  /* fetch both rosters */
  const [{ data: thisRoster }, { data: nextRoster }] = await Promise.all([
    sb.from('schedule_rosters').select('*').eq('date', thisDate).maybeSingle(),
    sb.from('schedule_rosters').select('*').eq('date', nextDate).maybeSingle(),
  ]);

  /* collect all assignee IDs */
  const profileIds = new Set<string>();
  const guestIds   = new Set<string>();

  function collectIds(roster: Record<string, unknown> | null) {
    if (!roster) return;
    ((roster.slots as unknown[]) || []).forEach((s: unknown) => {
      const slot = s as Record<string, unknown>;
      if (slot.assignee_type === 'member'  && slot.assignee_id)   profileIds.add(String(slot.assignee_id));
      if (slot.assignee_type === 'couple'  && slot.assignee_id)   profileIds.add(String(slot.assignee_id));
      if (slot.assignee_type === 'couple'  && slot.assignee_id_b) profileIds.add(String(slot.assignee_id_b));
      if (slot.assignee_type === 'guest'   && slot.guest_id)      guestIds.add(String(slot.guest_id));
    });
  }
  collectIds(thisRoster as Record<string, unknown>);
  collectIds(nextRoster as Record<string, unknown>);

  const [{ data: profiles }, { data: guests }] = await Promise.all([
    sb.from('profiles').select('id,first_name,full_name,email,phone1,phone1_type').in('id', [...profileIds]),
    guestIds.size ? sb.from('guests').select('id,name,email').in('id', [...guestIds]) : Promise.resolve({ data: [] }),
  ]);

  const profMap: Record<string, { first_name: string; full_name: string; email: string; phone1: string; phone1_type: string }> = {};
  (profiles || []).forEach((p) => { profMap[p.id] = p; });
  const guestMap: Record<string, { name: string; email: string }> = {};
  ((guests || []) as Array<{ id: string; name: string; email: string }>).forEach((g) => { guestMap[g.id] = g; });

  /* build assignee map: key → { type, id/email, this:[], next:[] } */
  type AssigneeEntry = { type: 'member' | 'guest'; key: string; email: string; firstName: string; this: unknown[]; next: unknown[] };
  const assigneeMap: Record<string, AssigneeEntry> = {};

  function addSlot(roster: Record<string, unknown> | null, which: 'this' | 'next') {
    if (!roster) return;
    ((roster.slots as unknown[]) || []).forEach((s: unknown) => {
      const slot = s as Record<string, unknown>;
      const atype = String(slot.assignee_type || '');
      if (!atype) return;

      if (atype === 'couple') {
        /* split couple into two individual entries */
        const ids = [String(slot.assignee_id || ''), String(slot.assignee_id_b || '')].filter(Boolean);
        ids.forEach((mid) => {
          const prof = profMap[mid]; if (!prof || !prof.email) return;
          const k = 'member:' + mid;
          if (!assigneeMap[k]) assigneeMap[k] = { type: 'member', key: k, email: prof.email, firstName: prof.first_name || (prof.full_name || '').split(' ')[0] || '', this: [], next: [] };
          const personalSlot = { ...slot, assignee_type: 'member', assignee_id: mid, assignee_id_b: null };
          assigneeMap[k][which].push(personalSlot);
        });
      } else if (atype === 'member') {
        const mid = String(slot.assignee_id || ''); const prof = profMap[mid]; if (!prof || !prof.email) return;
        const k = 'member:' + mid;
        if (!assigneeMap[k]) assigneeMap[k] = { type: 'member', key: k, email: prof.email, firstName: prof.first_name || (prof.full_name || '').split(' ')[0] || '', this: [], next: [] };
        assigneeMap[k][which].push(slot);
      } else if (atype === 'guest') {
        const gid = String(slot.guest_id || ''); const g = guestMap[gid]; if (!g || !g.email) return;
        const k = 'guest:' + gid;
        if (!assigneeMap[k]) assigneeMap[k] = { type: 'guest', key: k, email: g.email, firstName: g.name.split(' ')[0] || g.name, this: [], next: [] };
        assigneeMap[k][which].push(slot);
      }
    });
  }
  addSlot(thisRoster as Record<string, unknown>, 'this');
  addSlot(nextRoster as Record<string, unknown>, 'next');

  const thisLabel = formatDate(thisDate);
  const nextLabel = formatDate(nextDate);
  const thisTitle = (thisRoster as Record<string, unknown>)?.title as string || 'Sunday Service';
  const nextTitle = (nextRoster as Record<string, unknown>)?.title as string || 'Sunday Service';

  let sentCount = 0;

  for (const entry of Object.values(assigneeMap)) {
    if (!entry.this.length && !entry.next.length) continue;

    const thisRoles = entry.this.map((s) => (s as Record<string, unknown>).role || '').filter(Boolean).join(' & ');
    const nextRoles = entry.next.map((s) => (s as Record<string, unknown>).role || '').filter(Boolean).join(' & ');

    /* build swap buttons */
    let swapButtons = '';
    for (const slot of entry.this) {
      const role = String((slot as Record<string, unknown>).role || '');
      if (!role) continue;
      const swapUrl = await buildSwapToken(sb, thisDate, role, entry.firstName);
      swapButtons += `<tr><td style="padding:4px 40px;"><a href="${swapUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:9px 20px;border-radius:6px;">View ${role} Team Contact List</a></td></tr>`;
    }

    let html = emailOpen(`You're serving this Sunday at ${SITE_NAME}!`);
    html += `<tr><td style="height:28px;"></td></tr>`;
    html += `<tr><td style="padding:0 40px 4px;font-size:17px;color:#333;">Hey <strong>${entry.firstName}</strong>!</td></tr>`;

    if (entry.this.length) {
      html += `<tr><td style="height:16px;"></td></tr>`;
      html += sectionHeader(`This Sunday — ${thisLabel}`);
      html += `<tr><td style="padding:16px 40px 4px;font-size:16px;color:#333;line-height:1.6;">You're on <strong>${thisRoles}</strong> this Sunday${thisTitle !== 'Sunday Service' ? ` (${thisTitle})` : ''}!</td></tr>`;
    }

    if (entry.next.length) {
      html += `<tr><td style="height:12px;"></td></tr>`;
      html += sectionHeader(`Next Sunday — ${nextLabel}`);
      html += `<tr><td style="padding:16px 40px 4px;font-size:15px;color:#555;line-height:1.6;">And you're on <strong>${nextRoles}</strong> next week${nextTitle !== 'Sunday Service' ? ` (${nextTitle})` : ''}.</td></tr>`;
    }

    if (entry.this.length && swapButtons) {
      html += `<tr><td style="height:20px;"></td></tr>`;
      html += `<tr><td style="padding:0 40px 8px;font-size:14px;color:#666;line-height:1.7;">If for some reason you need to switch with someone, click below for your team's contact info:</td></tr>`;
      html += swapButtons;
    }

    html += `<tr><td style="height:24px;"></td></tr>`;
    html += emailClose();

    const subject = entry.this.length
      ? `${SITE_NAME} — You're serving this Sunday (${thisLabel})`
      : `${SITE_NAME} — You're serving next Sunday (${nextLabel})`;

    await sendEmail(entry.email, subject, html);
    sentCount++;
  }

  /* log to schedule_log */
  await sb.from('schedule_log').insert({ this_date: thisDate, next_date: nextDate, count: sentCount });

  return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
});
