// Preview + assertions for the reworked members/swap.html "Full Serving Team"
// page: full roster (includes the recipient), the recipient's checklist(s),
// other teams' checklists for the day, and team swap links. Mocked backend.
import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'results', 'screenshots');
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');

const future = new Date(Date.now() + 6 * 864e5).toISOString();
const seed = { db: {
  // One token per recipient, carrying the recipient's team ids (Brennan → Preaching).
  swap_tokens: [{ token: 'tok-test', date: '2026-06-28', role: 'Preaching', person_name: 'Brennan', team_ids: 't-preach', expires_at: future }],
  schedule_rosters: [{ date: '2026-06-28', title: 'Sunday Gathering', slots: [
    { role: 'Preaching', team_id: 't-preach', assignee_type: 'member', assignee_id: 'u-brennan' },
    { role: 'Sound', team_id: 't-sound', assignee_type: 'member', assignee_id: 'u-grace' },
    { role: 'Welcome / Greeting', team_id: 't-welcome', assignee_type: 'couple', assignee_id: 'u-mike', assignee_id_b: 'u-jen' },
    { role: 'Coffee', team_id: 't-welcome', assignee_type: 'guest', guest_id: 'g-jordan' },
  ]}],
  profiles: [
    { id: 'u-brennan', first_name: 'Brennan', last_name: 'Cattani', full_name: 'Brennan Cattani', email: 'brennan@example.com', phone1: '204-555-0101', phone1_type: 'Cell' },
    { id: 'u-grace', first_name: 'Grace', last_name: 'Lin', full_name: 'Grace Lin', email: 'grace@example.com', phone1: '204-555-0102', phone1_type: 'Cell' },
    { id: 'u-mike', first_name: 'Mike', last_name: 'Olsen', full_name: 'Mike Olsen', email: 'mike@example.com', phone1: '204-555-0103', phone1_type: 'Cell' },
    { id: 'u-jen', first_name: 'Jen', last_name: 'Olsen', full_name: 'Jen Olsen', email: 'jen@example.com', phone1: '', phone1_type: 'Cell' },
  ],
  guests: [{ id: 'g-jordan', name: 'Jordan Avery', email: 'jordan@example.com' }],
  teams: [
    { id: 't-preach', name: 'Preaching', instructions: 'Arrive 30 min early.\n[ ] Confirm the passage\n[ ] Mic check' },
    { id: 't-sound',   name: 'Sound',     instructions: 'Power on the board early.' },
    { id: 't-welcome', name: 'Welcome / Greeting', instructions: '' },  // no instructions → no checklist link
  ],
}};

let fails = 0;
const check = (label, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}  ${detail || ''}`); if (!cond) fails++; };

const { server, port } = await startServer(0);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

async function render(urlSuffix) {
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 1000, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  page.on('request', r => { if (r.url().includes('supabase-js')) r.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS }); else r.continue(); });
  await page.evaluateOnNewDocument(s => { window.__SEED__ = JSON.parse(s); }, JSON.stringify(seed));
  await page.goto(`http://127.0.0.1:${port}/members/swap.html${urlSuffix}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1100));
  return page;
}

// Primary render via the fragment link.
let page = await render('#tok-test');
await mkdir(SHOTS, { recursive: true });
await page.screenshot({ path: join(SHOTS, 'swap-preview.png'), fullPage: true });
const text = await page.evaluate(() => document.getElementById('swap-content').innerText);
const links = await page.evaluate(() => Array.from(document.querySelectorAll('#swap-content a')).map(a => a.getAttribute('href')));

console.log('--- rendered text ---\n' + text.trim() + '\n');

// Section 1 — full roster INCLUDING the recipient (Brennan / Preaching).
check('shows full roster incl. recipient (Brennan)', /Brennan/.test(text) && /\(you\)/.test(text));
check('roster lists other servers', /Grace Lin/.test(text) && /Jordan Avery/.test(text) && /Mike/.test(text));
// Section 2 — checklists.
check('recipient checklist link present (Preaching)', links.includes('/members/instructions.html#t-preach'));
check('other-team checklist link present (Sound)', links.includes('/members/instructions.html#t-sound'));
check('no checklist link for a team without instructions (Welcome)', !links.includes('/members/instructions.html#t-welcome'));
// Section 3 — swap team link for the recipient's team.
check('swap team link present (Preaching Team)', links.includes('/members/dashboard.html?tab=teams#team-t-preach'));
await page.close();

// Legacy ?token= path still resolves (older links in inboxes).
page = await render('?token=tok-test');
const legacyText = await page.evaluate(() => document.getElementById('swap-content').innerText);
check('legacy ?token= link still renders the page', /Full Serving Team|Who’s serving|Serving/.test(legacyText) && /Brennan/.test(legacyText));
await page.close();

await browser.close(); server.close();
console.log(`\n===== SWAP PAGE PREVIEW: ${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} =====`);
process.exit(fails ? 1 : 0);
