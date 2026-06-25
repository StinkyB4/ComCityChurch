// Quick visual preview of members/swap.html with a mocked backend + a populated
// roster, so we can verify the reworded note, recipient exclusion, team links,
// and the navy/red rebrand. No live backend.
import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'results', 'screenshots');
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');

const future = new Date(Date.now() + 6 * 864e5).toISOString();
const seed = { db: {
  swap_tokens: [{ token: 'tok-test', date: '2026-06-28', role: 'Preaching', person_name: 'Brennan', expires_at: future }],
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
  teams: [{ id: 't-preach', name: 'Preaching' }, { id: 't-sound', name: 'Sound' }, { id: 't-welcome', name: 'Welcome / Greeting' }],
}};

const { server, port } = await startServer(0);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
await page.setRequestInterception(true);
page.on('request', r => {
  if (r.url().includes('supabase-js')) r.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS });
  else r.continue();
});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.evaluateOnNewDocument(s => { window.__SEED__ = JSON.parse(s); }, JSON.stringify(seed));
await page.goto(`http://127.0.0.1:${port}/members/swap.html?token=tok-test`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1200));
await mkdir(SHOTS, { recursive: true });
await page.screenshot({ path: join(SHOTS, 'swap-preview.png'), fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
console.log('--- rendered text ---\n' + text);
console.log('--- console errors:', errors.length, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
