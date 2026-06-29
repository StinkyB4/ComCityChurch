// =============================================================================
// Members-portal mock-backend test driver (Puppeteer).
//
// Serves the real site, replaces the Supabase CDN bundle with our in-memory
// mock (mock-supabase.js), then logs in AS each person and drives the REAL
// dashboard UI:
//   • each volunteer's Welcome page → assert correct serving / child notifications
//   • the scheduler (admin) Master schedule → assert the roster mock-ups render
//   • the Teams tab → add a member, a child, and a non-member to a team
// Also renders the captured reminder emails to PNG.
//
// Writes nothing to any real backend; sends no email.
// Usage:  node run-portal-tests.mjs
// =============================================================================

import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { buildSeed } from './seed.mjs';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'results');
const SHOTS = join(OUT, 'screenshots');
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');

const seed = buildSeed();
const findings = [];
const record = (scenario, pass, detail) => { findings.push({ scenario, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${scenario}  ${detail || ''}`); };

async function newPortalPage(browser, uid) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.includes('supabase-js')) {
      req.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS });
    } else if (u.includes('cdn.jsdelivr.net') || u.includes('esm.sh') || u.includes('unpkg')) {
      // other CDN libs we don't need — stub empty so nothing hangs
      req.respond({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    } else { req.continue(); }
  });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.evaluateOnNewDocument((seedJson, theUid) => {
    window.__SEED__ = JSON.parse(seedJson);
    window.__AUTH_UID__ = theUid;
    window.__WRITES__ = [];
  }, JSON.stringify(seed), uid);
  page._errors = errors;
  return page;
}

const BASE = (await startServer(0));
const base = `http://127.0.0.1:${BASE.port}`;
console.log(`server ${base}\nThis Sunday=${seed.meta.SUN1}  Next=${seed.meta.SUN2}\n`);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
await mkdir(SHOTS, { recursive: true });

async function gotoTab(page, tab) {
  await page.goto(`${base}/members/dashboard.html?tab=${tab}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
}
const bodyText = (page) => page.evaluate(() => document.body.innerText || '');

// ── 1) Volunteer welcome pages ──────────────────────────────────────────────
const welcomeCases = [
  { uid: 'u-brennan', name: 'Brennan', expect: ['Your Upcoming Serving', 'Worship Lead'], child: ['Ella'] },
  { uid: 'u-sarah', name: 'Sarah', expect: ['Your Upcoming Serving', 'Greeter'], child: ['Noah'] },
  { uid: 'u-grace', name: 'Grace', expect: ['Your Upcoming Serving', 'Vocals'], child: [] },
  { uid: 'u-mike', name: 'Mike', expect: ['Your Upcoming Serving', 'Sound + Slides'], child: [] },
];

for (const c of welcomeCases) {
  const page = await newPortalPage(browser, c.uid);
  await gotoTab(page, 'welcome');
  const text = await bodyText(page);
  await page.screenshot({ path: join(SHOTS, `welcome-${c.name.toLowerCase()}.png`), fullPage: true });
  const missing = c.expect.filter(s => !text.includes(s));
  record(`welcome/${c.name} serving card`, missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : c.expect.join(' + '));
  if (c.child.length) {
    const childOk = c.child.every(s => text.includes(s));
    const hasChildCard = text.includes('Children Are Serving') || text.includes('serving this week');
    record(`welcome/${c.name} child notification`, childOk && hasChildCard, childOk ? 'child card present' : `missing child: ${c.child.join(',')}`);
  }
  if (page._errors.length) record(`welcome/${c.name} console`, false, `JS errors: ${page._errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

// ── 2) Scheduler (admin) master schedule ────────────────────────────────────
{
  const page = await newPortalPage(browser, 'u-tim');
  await gotoTab(page, 'master');
  await new Promise(r => setTimeout(r, 1200));
  const text = await bodyText(page);
  await page.screenshot({ path: join(SHOTS, `scheduler-master.png`), fullPage: true });
  const hasGrid = await page.$('#ms-tbl');
  const showsTeams = ['Worship', 'Welcome', 'Kids', 'A/V'].filter(t => text.includes(t));
  record('scheduler/master grid renders', !!hasGrid, hasGrid ? `teams shown: ${showsTeams.join(', ')}` : 'no #ms-tbl');
  if (page._errors.length) record('scheduler/master console', false, `JS errors: ${page._errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

// ── 3) Teams tab: actually ADD a member, a child, and a non-member ───────────
{
  const page = await newPortalPage(browser, 'u-tim');
  await gotoTab(page, 'teams');
  await page.screenshot({ path: join(SHOTS, `teams-tab.png`), fullPage: true });
  const text = await bodyText(page);
  const hasTeams = ['Worship', 'Kids', 'A/V'].filter(t => text.includes(t));
  record('teams/tab renders', hasTeams.length >= 2, `teams listed: ${hasTeams.join(', ')}`);

  // open the Kids Ministry team's edit form
  await page.evaluate(() => window.mpTeamEdit('t-kids'));
  await new Promise(r => setTimeout(r, 1200));
  const formExists = await page.$('#team-form');
  record('teams/edit form opens', !!formExists, formExists ? 'team-form rendered' : 'no #team-form');

  if (formExists) {
    // inventory the pickers the form exposes
    const inv = await page.evaluate(() => ({
      members: document.querySelectorAll('.mp-member-check').length,
      children: document.querySelectorAll('.mp-child-check').length,
      childParentAttrs: Array.from(document.querySelectorAll('.mp-child-check')).map(c => ({ id: c.value, parent: c.dataset.parentId || null })),
      addNonmemberBtn: !!document.querySelector('[onclick^="mpTeamAddNonmember"]'),
    }));
    record('teams/form has member picker', inv.members > 0, `${inv.members} member checkboxes`);
    record('teams/form has child picker', inv.children > 0, `${inv.children} child checkboxes; parents=${JSON.stringify(inv.childParentAttrs)}`);
    record('teams/form has non-member add', inv.addNonmemberBtn, inv.addNonmemberBtn ? 'add-non-member button present' : 'missing');

    // drive the form: add member Grace + child Noah + a non-member, then submit
    await page.evaluate(() => {
      const m = document.querySelector('.mp-member-check[value="u-grace"]'); if (m) m.checked = true;
      const c = document.querySelector('.mp-child-check[value="c-noah"]'); if (c) c.checked = true;
      if (window.mpTeamAddNonmember) window.mpTeamAddNonmember();
      const row = document.querySelector('#tm-nonmember-list .mp-nonmember-row');
      if (row) { const n = row.querySelector('[data-nm="name"]'); const e = row.querySelector('[data-nm="email"]'); if (n) n.value = 'Pat Visitor'; if (e) e.value = 'pat@example.com'; }
      window.__WRITES__ = []; // capture only the submit writes
      const f = document.getElementById('team-form');
      if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    await new Promise(r => setTimeout(r, 1200));

    const writes = await page.evaluate(() => window.__WRITES__ || []);
    const tmInsert = writes.find(w => w.op === 'insert' && w.table === 'team_members');
    if (tmInsert) {
      const rows = tmInsert.rows;
      const byType = {};
      rows.forEach(r => { const t = r.member_type || 'member'; (byType[t] = byType[t] || []).push(r); });
      record('teams/insert builds all 3 types', !!(byType.member && byType.child && byType.nonmember),
        `types: ${Object.keys(byType).join(', ')}`);
      // the backend-bug demonstration: which rows carry member_id = null?
      const nullMid = rows.filter(r => r.member_id == null);
      record('teams/non-member row has member_id=null (would violate NOT NULL in prod)',
        nullMid.length > 0, `${nullMid.length} row(s) with member_id=null: ${nullMid.map(r => r.member_type).join(', ')}`);
      const childRows = rows.filter(r => r.member_type === 'child');
      record('teams/child row carries parent member_id',
        childRows.length > 0 && childRows.every(r => r.member_id != null),
        childRows.map(r => `child_id=${r.child_id} member_id=${r.member_id}`).join('; ') || 'no child rows built');
      await writeFile(join(OUT, 'team-add-insert-payload.json'), JSON.stringify(tmInsert.rows, null, 2));
    } else {
      record('teams/insert builds rows', false, 'no team_members insert captured');
    }
  }
  if (page._errors.length) record('teams/console', false, `JS errors: ${page._errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

// ── 4) Render captured reminder emails to PNG ───────────────────────────────
try {
  const emailDir = join(OUT, 'emails');
  const files = (await readdir(emailDir)).filter(f => f.endsWith('.html'));
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 1 });
  for (const f of files) {
    const html = await readFile(join(emailDir, f), 'utf8');
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: join(SHOTS, `email-${f.replace('.html', '')}.png`), fullPage: true });
  }
  record('emails/rendered', files.length > 0, `${files.length} reminder emails rendered to PNG`);
  await page.close();
} catch (e) { record('emails/rendered', false, e.message); }

await browser.close();
BASE.server.close();

// ── report ───────────────────────────────────────────────────────────────────
const pass = findings.filter(f => f.pass).length, fail = findings.length - pass;
console.log(`\n===== PORTAL MOCK TEST SUMMARY =====\nPASS ${pass} / ${findings.length}   FAIL ${fail}`);
await writeFile(join(OUT, 'portal-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), meta: seed.meta, findings }, null, 2));
