/**
 * SEND-REMINDERS EDGE FUNCTION
 * Sends personalized serving reminder emails.
 *
 * Runs hourly via pg_cron. Checks portal_settings for the configured
 * day (0=Sun … 6=Sat) and hour (0–23, Central time) before sending.
 * Pass { force: true } in the request body to bypass the schedule check
 * (used by the "Send Reminders Now" admin button).
 *
 * pg_cron setup (run once in Supabase SQL editor):
 *   SELECT cron.schedule(
 *     'check-reminders',
 *     '0 * * * *',
 *     $$
 *       SELECT net.http_post(
 *         url     := 'https://lkmphayrithxkmhvfiep.supabase.co/functions/v1/send-reminders',
 *         headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
 *         body    := '{}'::jsonb
 *       )
 *     $$
 *   );
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'admin@commissionedcity.church';
const SITE_URL       = Deno.env.get('SITE_URL')       || 'https://commissionedcity.church';
const SITE_NAME      = Deno.env.get('SITE_NAME')      || 'Commissioned City Church';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || '';
const SERVICE_KEY    = Deno.env.get('SERVICE_ROLE_KEY') || '';
const BRAND  = '#112E53'; // Commissioned City navy (primary)
const ACCENT = '#D5393B'; // Commissioned City red (call-to-action)

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
</head><body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:${BRAND};padding:28px 40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.02em;text-transform:uppercase;">${SITE_NAME}</h1></td></tr>`;
}

function emailClose() {
  return `<tr><td style="background:#f4f5f7;padding:20px 40px;border-top:1px solid #e6e9ee;text-align:center;">
<p style="margin:0;font-size:12px;color:#8a94a3;">${SITE_NAME} — <a href="mailto:${ADMIN_EMAIL}" style="color:#8a94a3;">${ADMIN_EMAIL}</a></p>
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

/* ── Schedule check ──────────────────────────────────────────── */
function getCentralTime(now: Date): { day: number; hour: number } {
  // Returns day-of-week (0=Sun) and hour (0–23) in America/Winnipeg
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Winnipeg' }));
  return { day: central.getDay(), hour: central.getHours() };
}

function formatHour(h: number): string {
  if (h === 0)  return '12:00 AM';
  if (h < 12)   return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase credentials not set' }), { status: 500, headers: CORS });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  /* parse body — safe even for empty/non-JSON bodies */
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty body from pg_cron */ }
  const forceRun = body.force === true;

  /* ── Schedule check (skipped when force: true) ── */
  if (!forceRun) {
    const { data: settingsRows } = await sb.from('portal_settings').select('key,value');
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key: string; value: string }) => { settings[r.key] = r.value; });

    const reminderDay  = parseInt(settings.reminder_day  ?? '3', 10); // default Wednesday
    const reminderHour = parseInt(settings.reminder_hour ?? '9', 10); // default 9am

    const now = new Date();
    const { day: currentDay, hour: currentHour } = getCentralTime(now);

    if (currentDay !== reminderDay || currentHour !== reminderHour) {
      return new Response(JSON.stringify({
        ok: true, skipped: true,
        reason: `Not the scheduled time. Current: ${DAY_NAMES[currentDay]} ${formatHour(currentHour)} Central. Scheduled: ${DAY_NAMES[reminderDay]} ${formatHour(reminderHour)} Central.`
      }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    /* prevent duplicate sends in the same hour */
    const thisDate = nextSunday(now);
    const { data: alreadySent } = await sb.from('schedule_log')
      .select('id').eq('this_date', thisDate).maybeSingle();
    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `Reminders for ${thisDate} already sent.` }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
  }

  /* ── Main send logic ─────────────────────────────────────── */
  const now = new Date();
  const thisDate = nextSunday(now);
  const nextDate = sundayAfter(thisDate);

  const [{ data: thisRoster }, { data: nextRoster }] = await Promise.all([
    sb.from('schedule_rosters').select('*').eq('date', thisDate).maybeSingle(),
    sb.from('schedule_rosters').select('*').eq('date', nextDate).maybeSingle(),
  ]);

  const profileIds = new Set<string>();
  const guestIds   = new Set<string>();
  const childIds   = new Set<string>();

  function collectIds(roster: Record<string, unknown> | null) {
    if (!roster) return;
    ((roster.slots as unknown[]) || []).forEach((s: unknown) => {
      const slot = s as Record<string, unknown>;
      if (slot.assignee_type === 'member'  && slot.assignee_id)   profileIds.add(String(slot.assignee_id));
      if (slot.assignee_type === 'couple'  && slot.assignee_id)   profileIds.add(String(slot.assignee_id));
      if (slot.assignee_type === 'couple'  && slot.assignee_id_b) profileIds.add(String(slot.assignee_id_b));
      if (slot.assignee_type === 'guest'   && slot.guest_id)      guestIds.add(String(slot.guest_id));
      if (slot.assignee_type === 'child'   && slot.assignee_id)   childIds.add(String(slot.assignee_id));
    });
  }
  collectIds(thisRoster as Record<string, unknown>);
  collectIds(nextRoster as Record<string, unknown>);

  /* resolve children → their parent profile IDs */
  const childrenData = childIds.size
    ? (await sb.from('children').select('id,name,profile_id').in('id', [...childIds])).data || []
    : [];
  type ChildRow = { id: string; name: string; profile_id: string };
  const childById: Record<string, ChildRow> = {};
  (childrenData as ChildRow[]).forEach((c) => { childById[c.id] = c; profileIds.add(c.profile_id); });

  const [{ data: profiles }, { data: guests }] = await Promise.all([
    profileIds.size ? sb.from('profiles').select('id,first_name,full_name,email,phone1,phone1_type,spouse_id,child_notif_optout').in('id', [...profileIds]) : Promise.resolve({ data: [] }),
    guestIds.size   ? sb.from('guests').select('id,name,email').in('id', [...guestIds])                                                                     : Promise.resolve({ data: [] }),
  ]);

  type ProfRow = { id: string; first_name: string; full_name: string; email: string; phone1: string; phone1_type: string; spouse_id?: string; child_notif_optout?: boolean };
  const profMap: Record<string, ProfRow> = {};
  (profiles || []).forEach((p: ProfRow) => { profMap[p.id] = p; });

  /* fetch spouse profiles of child parents not already in profMap */
  const spouseIds = [...new Set(
    (childrenData as ChildRow[]).map(c => profMap[c.profile_id]?.spouse_id).filter(Boolean) as string[]
  )].filter(id => !profMap[id]);
  if (spouseIds.length) {
    const { data: spouseData } = await sb.from('profiles').select('id,first_name,full_name,email,phone1,phone1_type,spouse_id,child_notif_optout').in('id', spouseIds);
    (spouseData || []).forEach((p: ProfRow) => { profMap[p.id] = p; });
  }

  const guestMap: Record<string, { name: string; email: string }> = {};
  ((guests || []) as Array<{ id: string; name: string; email: string }>).forEach((g) => { guestMap[g.id] = g; });

  type AssigneeEntry = { type: 'member' | 'guest'; key: string; email: string; firstName: string; this: unknown[]; next: unknown[] };
  const assigneeMap: Record<string, AssigneeEntry> = {};

  function addAssignee(mid: string, slotWithMeta: unknown, which: 'this' | 'next') {
    const prof = profMap[mid]; if (!prof || !prof.email) return;
    const k = 'member:' + mid;
    if (!assigneeMap[k]) assigneeMap[k] = { type: 'member', key: k, email: prof.email, firstName: prof.first_name || (prof.full_name || '').split(' ')[0] || '', this: [], next: [] };
    assigneeMap[k][which].push(slotWithMeta);
  }

  function addSlot(roster: Record<string, unknown> | null, which: 'this' | 'next') {
    if (!roster) return;
    ((roster.slots as unknown[]) || []).forEach((s: unknown) => {
      const slot = s as Record<string, unknown>;
      const atype = String(slot.assignee_type || '');
      if (!atype) return;

      if (atype === 'couple') {
        const ids = [String(slot.assignee_id || ''), String(slot.assignee_id_b || '')].filter(Boolean);
        ids.forEach((mid) => addAssignee(mid, { ...slot, assignee_type: 'member', assignee_id: mid, assignee_id_b: null }, which));
      } else if (atype === 'member') {
        addAssignee(String(slot.assignee_id || ''), slot, which);
      } else if (atype === 'guest') {
        const gid = String(slot.guest_id || ''); const g = guestMap[gid]; if (!g || !g.email) return;
        const k = 'guest:' + gid;
        if (!assigneeMap[k]) assigneeMap[k] = { type: 'guest', key: k, email: g.email, firstName: g.name.split(' ')[0] || g.name, this: [], next: [] };
        assigneeMap[k][which].push(slot);
      } else if (atype === 'child') {
        /* route notification to parent(s), checking opt-out */
        const child = childById[String(slot.assignee_id || '')];
        if (!child) return;
        const slotWithChild = { ...slot, _child_name: child.name };
        const parentIds = [child.profile_id];
        const parentA = profMap[child.profile_id];
        if (parentA?.spouse_id) parentIds.push(parentA.spouse_id);
        parentIds.forEach((pid) => {
          const parent = profMap[pid];
          if (!parent || !parent.email || parent.child_notif_optout) return;
          addAssignee(pid, slotWithChild, which);
        });
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

    function slotLabel(s: unknown): string {
      const slot = s as Record<string, unknown>;
      const role = String(slot.role || '');
      const childName = slot._child_name ? String(slot._child_name) : null;
      return childName ? `${role} (${childName})` : role;
    }
    const thisRoles = entry.this.map(slotLabel).filter(Boolean).join(' & ');
    const nextRoles = entry.next.map(slotLabel).filter(Boolean).join(' & ');

    let swapButtons = '';
    for (const slot of entry.this) {
      const role = String((slot as Record<string, unknown>).role || '');
      if (!role) continue;
      const swapUrl = await buildSwapToken(sb, thisDate, role, entry.firstName);
      swapButtons += `<tr><td style="padding:4px 40px;"><a href="${swapUrl}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:9px 20px;border-radius:6px;">View ${role} Team Contact List</a></td></tr>`;
    }

    let html = emailOpen(`You're serving this Sunday at ${SITE_NAME}!`);
    html += `<tr><td style="height:28px;"></td></tr>`;
    html += `<tr><td style="padding:0 40px 4px;font-size:17px;color:#333;">Hey <strong>${entry.firstName}</strong>!</td></tr>`;

    /* check if ALL slots are child slots (parent notification only) */
    const allChildSlots = (s: unknown[]) => s.every(x => (x as Record<string,unknown>)._child_name);
    const childOnlyThis = entry.this.length > 0 && allChildSlots(entry.this);
    const childOnlyNext = entry.next.length > 0 && allChildSlots(entry.next);

    /* in-portal "welcome board" card — mirrors the email so both parents see
       "your child is serving" on their dashboard, not just by email. Reuses
       the member_notifications inbox built for the age-18 transition policy
       (sql/migrate_age_transitions.sql + renderWelcomeTab in dashboard.js). */
    const childSlotsThis = entry.this.filter((s) => (s as Record<string, unknown>)._child_name);
    const childSlotsNext = entry.next.filter((s) => (s as Record<string, unknown>)._child_name);
    if (entry.type === 'member' && (childSlotsThis.length || childSlotsNext.length)) {
      const childNames = [...new Set(
        [...childSlotsThis, ...childSlotsNext].map((s) => String((s as Record<string, unknown>)._child_name))
      )];
      const who = childNames.length > 1 ? `${childNames.join(' & ')} are` : `${childNames[0]} is`;
      const parts: string[] = [];
      if (childSlotsThis.length) parts.push(`scheduled for <strong>${thisRoles}</strong> this Sunday (${thisLabel})`);
      if (childSlotsNext.length) parts.push(`scheduled for <strong>${nextRoles}</strong> next Sunday (${nextLabel})`);
      const uniqueChildIds = [...new Set(
        [...childSlotsThis, ...childSlotsNext].map((s) => String((s as Record<string, unknown>).assignee_id))
      )];
      const pid = entry.key.startsWith('member:') ? entry.key.slice('member:'.length) : null;
      if (pid) {
        await sb.from('member_notifications').insert({
          profile_id: pid,
          type: 'child_scheduled',
          title: `${who} serving this week`,
          body: `${who} ${parts.join(' and ')}.`,
          child_id: uniqueChildIds.length === 1 ? uniqueChildIds[0] : null,
        });
      }
    }

    if (entry.this.length) {
      html += `<tr><td style="height:16px;"></td></tr>`;
      html += sectionHeader(`This Sunday — ${thisLabel}`);
      if (childOnlyThis) {
        html += `<tr><td style="padding:16px 40px 4px;font-size:16px;color:#333;line-height:1.6;">Your child is scheduled for <strong>${thisRoles}</strong> this Sunday${thisTitle !== 'Sunday Service' ? ` (${thisTitle})` : ''}.</td></tr>`;
      } else {
        html += `<tr><td style="padding:16px 40px 4px;font-size:16px;color:#333;line-height:1.6;">You're on <strong>${thisRoles}</strong> this Sunday${thisTitle !== 'Sunday Service' ? ` (${thisTitle})` : ''}!</td></tr>`;
      }
    }

    if (entry.next.length) {
      html += `<tr><td style="height:12px;"></td></tr>`;
      html += sectionHeader(`Next Sunday — ${nextLabel}`);
      if (childOnlyNext) {
        html += `<tr><td style="padding:16px 40px 4px;font-size:15px;color:#555;line-height:1.6;">Your child is scheduled for <strong>${nextRoles}</strong> next week${nextTitle !== 'Sunday Service' ? ` (${nextTitle})` : ''}.</td></tr>`;
      } else {
        html += `<tr><td style="padding:16px 40px 4px;font-size:15px;color:#555;line-height:1.6;">And you're on <strong>${nextRoles}</strong> next week${nextTitle !== 'Sunday Service' ? ` (${nextTitle})` : ''}.</td></tr>`;
      }
    }

    if (entry.this.length && swapButtons) {
      html += `<tr><td style="height:20px;"></td></tr>`;
      html += `<tr><td style="padding:0 40px 8px;font-size:14px;color:#666;line-height:1.7;">If you need to swap with someone, click below for your team's contact info:</td></tr>`;
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

  await sb.from('schedule_log').insert({ this_date: thisDate, next_date: nextDate, count: sentCount });

  return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
});
