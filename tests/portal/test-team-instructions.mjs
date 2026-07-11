// Focused test for the team instructions/checklist feature in the dashboard
// Teams tab: read-view display + "In reminder emails" badge, the edit-form
// textarea + toggle (prefilled), and that saving persists both new columns.
import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { buildSeed } from './seed.mjs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');
const seed = buildSeed();

let fails = 0;
const record = (label, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail || ''}`); if (!pass) fails++; };

const { port, ...srv } = await startServer(0);
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function portalPage(uid) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.includes('supabase-js')) req.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS });
    else if (u.includes('cdn.jsdelivr.net') || u.includes('esm.sh') || u.includes('unpkg')) req.respond({ status: 200, contentType: 'application/javascript', body: '/* stub */' });
    else req.continue();
  });
  await page.evaluateOnNewDocument((s, theUid) => { window.__SEED__ = JSON.parse(s); window.__AUTH_UID__ = theUid; window.__WRITES__ = []; }, JSON.stringify(seed), uid);
  return page;
}

// Admin (Tim) opens the Teams tab.
const page = await portalPage('u-tim');
await page.goto(`${base}/members/dashboard.html?tab=teams`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

// 1) Read-view: Worship (seeded with instructions + flag on) shows the doc + badge.
//    The team card is a collapsed <details>, so open it first, then read the
//    rendered text of its body.
const readView = await page.evaluate(() => {
  const el = document.getElementById('team-t-worship');
  if (el) el.open = true;
  const body = (el ? el.innerText : document.body.innerText) || '';
  const badge = /In reminder emails/.test(body);
  const instrText = /Serving Instructions/i.test(body) && /soundcheck/i.test(body) && /Confirm the setlist/i.test(body);
  return { badge, instrText };
});
record('read-view shows Worship instructions', readView.instrText);
record('read-view shows "In reminder emails" badge', readView.badge);

// 2) Edit form for Worship: textarea prefilled + toggle checked.
await page.evaluate(() => window.mpTeamEdit('t-worship'));
await new Promise(r => setTimeout(r, 1000));
const form = await page.evaluate(() => {
  const ta = document.querySelector('#team-form textarea[name="instructions"]');
  const cb = document.querySelector('#team-form input[name="include_instructions_in_reminder"]');
  return { hasTextarea: !!ta, textareaVal: ta ? ta.value : '', toggleChecked: cb ? cb.checked : null };
});
record('edit form has instructions textarea', form.hasTextarea);
record('textarea is prefilled with existing instructions', /soundcheck/i.test(form.textareaVal));
record('include-in-reminder toggle reflects saved value (checked)', form.toggleChecked === true);

// 3) Edit + save: change text, toggle OFF, submit → update carries both columns.
const upd = await page.evaluate(() => {
  const ta = document.querySelector('#team-form textarea[name="instructions"]');
  const cb = document.querySelector('#team-form input[name="include_instructions_in_reminder"]');
  ta.value = 'Updated: arrive by 8:00.\n[ ] New checklist item';
  cb.checked = false;
  window.__WRITES__ = [];
  const f = document.getElementById('team-form');
  if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true }));
  return true;
});
await new Promise(r => setTimeout(r, 1200));
const writes = await page.evaluate(() => window.__WRITES__ || []);
const teamUpd = writes.find(w => w.op === 'update' && w.table === 'teams');
record('save issues a teams update', !!teamUpd, teamUpd ? 'update captured' : 'no teams update write');
if (teamUpd) {
  const row = Array.isArray(teamUpd.rows) ? teamUpd.rows[0] : teamUpd.rows;
  const payloadOk = row && /Updated: arrive by 8:00/.test(row.instructions || '') && row.include_instructions_in_reminder === false;
  record('update payload carries instructions + toggle', payloadOk, JSON.stringify({ instr: (row && row.instructions || '').slice(0, 30), flag: row && row.include_instructions_in_reminder }));
}

await browser.close(); srv.server.close();
console.log(`\n===== TEAM INSTRUCTIONS UI: ${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} =====`);
process.exit(fails ? 1 : 0);
