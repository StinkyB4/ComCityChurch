// Focused test: the team edit form lets you designate a leader, and saving
// persists teams.leader_id + marks that person's team_members row role='leader'
// (and auto-adds them to the team).
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

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
await page.setRequestInterception(true);
page.on('request', req => {
  const u = req.url();
  if (u.includes('supabase-js')) req.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS });
  else if (u.includes('cdn.jsdelivr.net') || u.includes('esm.sh') || u.includes('unpkg')) req.respond({ status: 200, contentType: 'application/javascript', body: '/* stub */' });
  else req.continue();
});
await page.evaluateOnNewDocument((s, uid) => { window.__SEED__ = JSON.parse(s); window.__AUTH_UID__ = uid; window.__WRITES__ = []; }, JSON.stringify(seed), 'u-tim');

await page.goto(`${base}/members/dashboard.html?tab=teams`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

// Open Worship edit form (seed leader_id = u-brennan).
await page.evaluate(() => window.mpTeamEdit('t-worship'));
await new Promise(r => setTimeout(r, 1000));

const form = await page.evaluate(() => {
  const sel = document.querySelector('#team-form select[name="leader_id"]');
  return {
    hasSelect: !!sel,
    optionCount: sel ? sel.querySelectorAll('option').length : 0,
    selectedValue: sel ? sel.value : null,
  };
});
record('edit form has a Team Leader dropdown', form.hasSelect);
record('dropdown pre-selects the current leader (Brennan)', form.selectedValue === 'u-brennan', 'selected=' + form.selectedValue);
record('dropdown lists members + a "no leader" option', form.optionCount >= 3, 'options=' + form.optionCount);

// Change leader to Grace (who is NOT initially checked as a member on Worship? she is a member),
// then submit and inspect the writes.
const res = await page.evaluate(() => {
  const sel = document.querySelector('#team-form select[name="leader_id"]');
  sel.value = 'u-grace';
  window.__WRITES__ = [];
  const f = document.getElementById('team-form');
  if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true }));
  return true;
});
await new Promise(r => setTimeout(r, 1200));
const writes = await page.evaluate(() => window.__WRITES__ || []);

const teamUpd = writes.find(w => w.op === 'update' && w.table === 'teams');
record('save updates teams.leader_id', !!(teamUpd && (Array.isArray(teamUpd.rows) ? teamUpd.rows[0] : teamUpd.rows).leader_id === 'u-grace'),
  teamUpd ? 'leader_id=' + (Array.isArray(teamUpd.rows) ? teamUpd.rows[0] : teamUpd.rows).leader_id : 'no teams update');

const tmInsert = writes.find(w => w.op === 'insert' && w.table === 'team_members');
const rows = tmInsert ? tmInsert.rows : [];
const graceRow = rows.find(r => r.member_id === 'u-grace');
record('leader row is inserted with role=leader', !!(graceRow && graceRow.role === 'leader'), graceRow ? 'role=' + graceRow.role : 'no u-grace row');
const leaderRows = rows.filter(r => r.role === 'leader');
record('exactly one leader row', leaderRows.length === 1, 'count=' + leaderRows.length);

await browser.close(); srv.server.close();
console.log(`\n===== TEAM LEADER: ${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} =====`);
process.exit(fails ? 1 : 0);
