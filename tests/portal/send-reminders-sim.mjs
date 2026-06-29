// =============================================================================
// Faithful Node simulation of supabase/functions/send-reminders/index.ts.
//
// Same roster-reading, couple-splitting, child→parent routing, opt-out, and
// email-building logic — but instead of POSTing to Resend it CAPTURES every
// email (to /results/emails/*.html) and prints who would receive what.
// Reads the shared seed; sends nothing anywhere.
// =============================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'results', 'emails');

const SITE_NAME = 'Commissioned City Church';
const SITE_URL = 'https://commissionedcity.church';
const ADMIN_EMAIL = 'admin@commissionedcity.church';
const BRAND = '#112E53';  // Commissioned City navy (primary) — mirrors the edge function
const ACCENT = '#D5393B'; // Commissioned City red (call-to-action)

const seed = buildSeed();
const DB = seed.db;
const captured = []; // { to, subject, html }
const notificationsInserted = []; // member_notifications rows the function would insert

// ── date helpers (identical to the edge function) ───────────────────────────
function nextSunday(from) {
  const dow = from.getDay();
  const days = (dow === 0 && from.getHours() >= 12) ? 7 : ((7 - dow) % 7 === 0 ? 0 : (7 - dow) % 7);
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function sundayAfter(dateStr) { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; }
function formatDate(dateStr) { const d = new Date(dateStr + 'T12:00:00'); return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }); }

const rosterFor = (date) => DB.schedule_rosters.find(r => r.date === date) || null;
const childById = (id) => DB.children.find(c => c.id === id) || null;
const profById = (id) => DB.profiles.find(p => p.id === id) || null;
const guestById = (id) => DB.guests.find(g => g.id === id) || null;

function sendEmail(to, subject, html) { captured.push({ to, subject, html }); }
function buildSwapToken(date, role, personName) {
  const token = 'tok-' + Math.random().toString(36).slice(2, 10);
  DB.swap_tokens.push({ token, date, role, person_name: personName });
  return `${SITE_URL}/members/swap.html?token=${token}`;
}

// ── email chrome (mirrors the edge function) ────────────────────────────────
const emailOpen = (preview = '') => `<!DOCTYPE html><html><head><meta charset="UTF-8">${preview ? `<span style="display:none">${preview}</span>` : ''}</head><body style="margin:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;"><tr><td style="background:${BRAND};padding:28px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.02em;text-transform:uppercase;">${SITE_NAME}</h1></td></tr>`;
const emailClose = () => `<tr><td style="background:#f4f5f7;padding:20px 40px;border-top:1px solid #e6e9ee;text-align:center;"><p style="margin:0;font-size:12px;color:#8a94a3;">${SITE_NAME} — ${ADMIN_EMAIL}</p></td></tr></table></td></tr></table></body></html>`;
const sectionHeader = (label) => `<tr><td style="background:${BRAND};padding:10px 40px;"><p style="margin:0;color:#fff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;">${label}</p></td></tr>`;

function run() {
  const now = new Date();
  const thisDate = nextSunday(now);
  const nextDate = sundayAfter(thisDate);
  const thisRoster = rosterFor(thisDate);
  const nextRoster = rosterFor(nextDate);

  const profileIds = new Set(), childIds = new Set(), guestIds = new Set(), familyParentIds = new Set();
  const collect = (roster) => (roster?.slots || []).forEach(s => {
    if ((s.assignee_type === 'member' || s.assignee_type === 'couple') && s.assignee_id) profileIds.add(s.assignee_id);
    if (s.assignee_type === 'couple' && s.assignee_id_b) profileIds.add(s.assignee_id_b);
    if (s.assignee_type === 'guest' && s.guest_id) guestIds.add(s.guest_id);
    if (s.assignee_type === 'child' && s.assignee_id) childIds.add(s.assignee_id);
    if (s.assignee_type === 'family') { if (s.assignee_id) { profileIds.add(s.assignee_id); familyParentIds.add(s.assignee_id); } if (s.assignee_id_b) { profileIds.add(s.assignee_id_b); familyParentIds.add(s.assignee_id_b); } }
  });
  collect(thisRoster); collect(nextRoster);
  const familyKidsByParent = {};
  DB.children.filter(c => familyParentIds.has(c.profile_id)).forEach(c => { (familyKidsByParent[c.profile_id] = familyKidsByParent[c.profile_id] || []).push(c.name); });

  const childMap = {};
  [...childIds].forEach(id => { const c = childById(id); if (c) { childMap[id] = c; profileIds.add(c.profile_id); } });
  const profMap = {}; [...profileIds].forEach(id => { const p = profById(id); if (p) profMap[id] = p; });
  // spouses of child parents
  Object.values(childMap).forEach(c => { const sp = profMap[c.profile_id]?.spouse_id; if (sp && !profMap[sp]) { const p = profById(sp); if (p) profMap[sp] = p; } });
  const guestMap = {}; [...guestIds].forEach(id => { const g = guestById(id); if (g) guestMap[id] = g; });

  const assigneeMap = {};
  const addAssignee = (mid, slotMeta, which) => {
    const prof = profMap[mid]; if (!prof || !prof.email) return;
    const k = 'member:' + mid;
    if (!assigneeMap[k]) assigneeMap[k] = { type: 'member', key: k, email: prof.email, firstName: prof.first_name || (prof.full_name || '').split(' ')[0], this: [], next: [] };
    assigneeMap[k][which].push(slotMeta);
  };
  const addSlot = (roster, which) => (roster?.slots || []).forEach(s => {
    const a = s.assignee_type;
    if (a === 'couple') {
      [s.assignee_id, s.assignee_id_b].filter(Boolean).forEach(mid => addAssignee(mid, { ...s, assignee_type: 'member', assignee_id: mid, assignee_id_b: null }, which));
    } else if (a === 'member') {
      addAssignee(s.assignee_id, s, which);
    } else if (a === 'guest') {
      const g = guestMap[s.guest_id]; if (!g || !g.email) return;
      const k = 'guest:' + s.guest_id;
      if (!assigneeMap[k]) assigneeMap[k] = { type: 'guest', key: k, email: g.email, firstName: (g.name || '').split(' ')[0], this: [], next: [] };
      assigneeMap[k][which].push(s);
    } else if (a === 'child') {
      const child = childMap[s.assignee_id]; if (!child) return;
      const slotWithChild = { ...s, _child_name: child.name };
      const parentIds = [child.profile_id];
      const parentA = profMap[child.profile_id];
      if (parentA?.spouse_id) parentIds.push(parentA.spouse_id);
      parentIds.forEach(pid => { const parent = profMap[pid]; if (!parent || !parent.email || parent.child_notif_optout) return; addAssignee(pid, slotWithChild, which); });
    } else if (a === 'family') {
      const parents = [s.assignee_id, s.assignee_id_b].filter(Boolean);
      const anchor = profMap[parents[0]];
      const surname = (anchor && anchor.last_name) || s.family_name || '';
      const label = (surname ? surname + ' ' : '') + 'Family';
      const parentFirst = parents.map(pid => { const p = profMap[pid]; return p ? (p.first_name || (p.full_name || '').split(' ')[0]) : ''; }).filter(Boolean);
      const kids = [...new Set(parents.flatMap(pid => familyKidsByParent[pid] || []))];
      const slotWithFamily = { ...s, _family_label: label, _family_members: [...parentFirst, ...kids] };
      parents.forEach(pid => addAssignee(pid, slotWithFamily, which));
    }
  });
  addSlot(thisRoster, 'this'); addSlot(nextRoster, 'next');

  const thisLabel = formatDate(thisDate), nextLabel = formatDate(nextDate);
  let sentCount = 0;

  for (const entry of Object.values(assigneeMap)) {
    if (!entry.this.length && !entry.next.length) continue;
    const slotLabel = (s) => s._family_label ? `${s.role} (${s._family_label})` : (s._child_name ? `${s.role} (${s._child_name})` : s.role);
    const thisRoles = entry.this.map(slotLabel).filter(Boolean).join(' & ');
    const nextRoles = entry.next.map(slotLabel).filter(Boolean).join(' & ');

    // in-portal welcome-board card for child slots (both parents)
    const childSlotsThis = entry.this.filter(s => s._child_name);
    const childSlotsNext = entry.next.filter(s => s._child_name);
    if (entry.type === 'member' && (childSlotsThis.length || childSlotsNext.length)) {
      const names = [...new Set([...childSlotsThis, ...childSlotsNext].map(s => s._child_name))];
      const who = names.length > 1 ? `${names.join(' & ')} are` : `${names[0]} is`;
      const parts = [];
      if (childSlotsThis.length) parts.push(`scheduled for ${thisRoles} this Sunday (${thisLabel})`);
      if (childSlotsNext.length) parts.push(`scheduled for ${nextRoles} next Sunday (${nextLabel})`);
      const pid = entry.key.slice('member:'.length);
      notificationsInserted.push({ profile_id: pid, type: 'child_scheduled', title: `${who} serving this week`, body: `${who} ${parts.join(' and ')}.` });
    }

    // family notification (both parents) + the family members to list in the email
    const familySlotsThis = entry.this.filter(s => s._family_label);
    const familySlotsNext = entry.next.filter(s => s._family_label);
    if (entry.type === 'member' && (familySlotsThis.length || familySlotsNext.length)) {
      const famLabels = [...new Set([...familySlotsThis, ...familySlotsNext].map(s => s._family_label))];
      const rolesThis = [...new Set(familySlotsThis.map(s => s.role))].filter(Boolean).join(' & ');
      const rolesNext = [...new Set(familySlotsNext.map(s => s.role))].filter(Boolean).join(' & ');
      const fparts = [];
      if (familySlotsThis.length) fparts.push(`scheduled for ${rolesThis} this Sunday (${thisLabel})`);
      if (familySlotsNext.length) fparts.push(`scheduled for ${rolesNext} next Sunday (${nextLabel})`);
      notificationsInserted.push({ profile_id: entry.key.slice('member:'.length), type: 'family_scheduled', title: 'Your family is serving this week', body: `The ${famLabels.join(' & ')} is ${fparts.join(' and ')}.` });
    }
    const famMembers = [...new Set([...entry.this, ...entry.next].flatMap(s => s._family_members || []))];

    let swapButtons = '';
    for (const s of entry.this) { if (!s.role) continue; const u = buildSwapToken(thisDate, s.role, entry.firstName); swapButtons += `<tr><td style="padding:4px 40px;"><a href="${u}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:9px 20px;border-radius:6px;">View ${s.role} Team Contact List</a></td></tr>`; }

    let html = emailOpen(`You're serving this Sunday at ${SITE_NAME}!`);
    html += `<tr><td style="height:28px;"></td></tr><tr><td style="padding:0 40px 4px;font-size:17px;color:#333;">Hey <strong>${entry.firstName}</strong>!</td></tr>`;
    const allChild = (arr) => arr.length > 0 && arr.every(x => x._child_name);
    if (entry.this.length) {
      html += `<tr><td style="height:16px;"></td></tr>` + sectionHeader(`This Sunday — ${thisLabel}`);
      html += allChild(entry.this)
        ? `<tr><td style="padding:16px 40px 4px;font-size:16px;color:#333;">Your child is scheduled for <strong>${thisRoles}</strong> this Sunday.</td></tr>`
        : `<tr><td style="padding:16px 40px 4px;font-size:16px;color:#333;">You're on <strong>${thisRoles}</strong> this Sunday!</td></tr>`;
    }
    if (entry.next.length) {
      html += `<tr><td style="height:12px;"></td></tr>` + sectionHeader(`Next Sunday — ${nextLabel}`);
      html += allChild(entry.next)
        ? `<tr><td style="padding:16px 40px 4px;font-size:15px;color:#555;">Your child is scheduled for <strong>${nextRoles}</strong> next week.</td></tr>`
        : `<tr><td style="padding:16px 40px 4px;font-size:15px;color:#555;">And you're on <strong>${nextRoles}</strong> next week.</td></tr>`;
    }
    if (famMembers.length) html += `<tr><td style="height:8px;"></td></tr><tr><td style="padding:0 40px 4px;font-size:14px;color:#666;">Serving as a family: <strong>${famMembers.join(', ')}</strong></td></tr>`;
    if (entry.this.length && swapButtons) html += `<tr><td style="height:20px;"></td></tr>` + swapButtons;
    html += `<tr><td style="height:24px;"></td></tr>` + emailClose();

    const subject = entry.this.length
      ? `${SITE_NAME} — You're serving this Sunday (${thisLabel})`
      : `${SITE_NAME} — You're serving next Sunday (${nextLabel})`;
    sendEmail(entry.email, subject, html);
    sentCount++;
  }

  return { thisDate, nextDate, sentCount };
}

// ── run + report ────────────────────────────────────────────────────────────
const { thisDate, nextDate, sentCount } = run();
await mkdir(OUT, { recursive: true });

let i = 0;
for (const e of captured) {
  i++;
  await writeFile(join(OUT, `${String(i).padStart(2, '0')}-${e.to.replace(/[^a-z0-9]/gi, '_')}.html`), e.html);
}

const who = (email) => (seed.db.profiles.find(p => p.email === email) || seed.db.guests.find(g => g.email === email) || {}).full_name
  || (seed.db.guests.find(g => g.email === email) || {}).name || email;

console.log(`\n===== SEND-REMINDERS SIMULATION =====`);
console.log(`This Sunday: ${thisDate}   Next Sunday: ${nextDate}`);
console.log(`Emails generated (NONE sent): ${sentCount}\n`);
console.log('TO'.padEnd(26), 'SUBJECT');
console.log('-'.repeat(90));
for (const e of captured) {
  console.log((who(e.to) + ' <' + e.to + '>').padEnd(26), e.subject.replace(SITE_NAME + ' — ', ''));
}
console.log(`\n--- Roles each recipient is reminded about ---`);
// re-derive readable role lines from captured html
for (const e of captured) {
  const m = e.html.match(/You're on <strong>(.*?)<\/strong>/);
  const child = e.html.match(/Your child is scheduled for <strong>(.*?)<\/strong>/g) || [];
  const lines = [];
  if (m) lines.push('self: ' + m[1]);
  child.forEach(c => lines.push('child: ' + c.replace(/<[^>]+>/g, '').replace('Your child is scheduled for ', '')));
  console.log(' • ' + who(e.to).padEnd(20), lines.join(' | '));
}
console.log(`\n--- In-portal "child serving" cards inserted (member_notifications) ---`);
notificationsInserted.forEach(n => console.log(` • ${who(seed.db.profiles.find(p=>p.id===n.profile_id)?.email)} ← "${n.title}"`));
console.log(`\nEmail HTML written to: ${OUT}`);
