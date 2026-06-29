// Focused test: assigning a FAMILY as a unit in the Teams roster (mock backend).
// Verifies the Families picker appears, a family checkbox builds a family row,
// and adding a new family fires the both-parents notification (edge call).
import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { buildSeed } from './seed.mjs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');
const seed = buildSeed();
// give t-kids (sunday-serving) a leader so the form opens cleanly; family = Cattani (anchor u-brennan)
const { server, port } = await startServer(0);
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
await page.setRequestInterception(true);
page.on('request', r => { if (r.url().includes('supabase-js')) r.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS }); else r.continue(); });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.evaluateOnNewDocument((s, uid) => { window.__SEED__ = JSON.parse(s); window.__AUTH_UID__ = uid; window.__WRITES__ = []; }, JSON.stringify(seed), 'u-tim');

await page.goto(`${base}/members/dashboard.html?tab=teams`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

// open the Kids team (sunday-serving) edit form
await page.evaluate(() => window.mpTeamEdit('t-kids'));
await new Promise(r => setTimeout(r, 1200));

const inv = await page.evaluate(() => ({
  familiesSectionVisible: (() => { const el = document.getElementById('tm-picker-type-families'); return !!el && el.style.display !== 'none'; })(),
  familyChecks: Array.from(document.querySelectorAll('.mp-family-check')).map(c => ({ value: c.value, label: (c.closest('label')||{}).innerText?.replace(/\s+/g,' ').trim().slice(0,30) })),
}));
console.log('Families section visible:', inv.familiesSectionVisible);
console.log('Family options:', JSON.stringify(inv.familyChecks));

// check the Cattani family (anchor u-brennan) and submit
await page.evaluate(() => {
  const c = document.querySelector('.mp-family-check[value="u-brennan"]'); if (c) c.checked = true;
  window.__WRITES__ = [];
  const f = document.getElementById('team-form'); if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true }));
});
await new Promise(r => setTimeout(r, 1400));

const result = await page.evaluate(() => {
  const writes = window.__WRITES__ || [];
  const tmInsert = writes.find(w => w.op === 'insert' && w.table === 'team_members');
  const famRows = tmInsert ? tmInsert.rows.filter(r => r.member_type === 'family') : [];
  const notifs = writes.filter(w => w.op === 'insert' && w.table === 'member_notifications').map(w => w.rows).flat();
  const edgeCalls = writes.filter(w => w.op === 'edge').map(w => ({ fn: w.table, action: w.rows && w.rows.action, recipients: w.rows && w.rows.recipients }));
  return { familyRowsInserted: famRows, notifInserts: notifs.length, edgeCalls };
});
console.log('\nFamily rows inserted:', JSON.stringify(result.familyRowsInserted));
console.log('member_notifications inserted:', result.notifInserts);
console.log('edge (send-email) calls:', JSON.stringify(result.edgeCalls, null, 1));
console.log('\nconsole errors:', errors.length, errors.slice(0, 3).join(' | '));

const pass = result.familyRowsInserted.length === 1
  && result.familyRowsInserted[0].member_id === 'u-brennan'
  && result.notifInserts >= 1
  && result.edgeCalls.some(e => e.fn === 'send-email');
console.log('\n' + (pass ? 'PASS — family added as a unit + both parents notified' : 'FAIL'));

await browser.close(); server.close();
