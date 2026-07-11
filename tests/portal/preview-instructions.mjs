// Visual + behavioral preview of members/instructions.html with a mocked
// backend. Verifies the fragment (#<team_id>) load path, the checklist/bullet
// rendering, and the graceful "no instructions" and "not found" states. No live
// backend.
import puppeteer from 'puppeteer';
import { startServer } from '../ux/static-server.mjs';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'results', 'screenshots');
const MOCK_JS = await readFile(join(__dirname, 'mock-supabase.js'), 'utf8');

const seed = { db: {
  teams: [
    { id: 't-setup', name: 'Setup', include_instructions_in_reminder: true,
      instructions: 'Arrive by 8:30am to open the building.\n\nSetup checklist:\n[x] Unlock the doors\n[ ] Put out the chairs (rows of 8)\n[ ] Start the coffee\n- Sanctuary lights: panel by the stage\n- Thermostat target: 70°F' },
    { id: 't-empty', name: 'Greeting', include_instructions_in_reminder: false, instructions: '' },
  ],
}};

const { server, port } = await startServer(0);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

let failures = 0;
function check(label, cond, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
  if (!cond) failures++;
}

async function load(urlSuffix) {
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (r.url().includes('supabase-js')) r.respond({ status: 200, contentType: 'application/javascript', body: MOCK_JS });
    else r.continue();
  });
  await page.evaluateOnNewDocument(s => { window.__SEED__ = JSON.parse(s); }, JSON.stringify(seed));
  await page.goto(`http://127.0.0.1:${port}/members/instructions.html${urlSuffix}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 900));
  return page;
}

// 1) Happy path: fragment link renders the checklist.
let page = await load('#t-setup');
let text = await page.evaluate(() => document.getElementById('doc-content').innerText);
await mkdir(SHOTS, { recursive: true });
await page.screenshot({ path: join(SHOTS, 'instructions-preview.png'), fullPage: true });
check('fragment link renders instructions', /Serving Instructions/.test(text) && /Setup/.test(text));
check('checklist items present', /Unlock the doors/.test(text) && /Start the coffee/.test(text));
check('bullet items present', /Sanctuary lights/.test(text));
const checkedBoxes = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#doc-content li span')).filter(s => s.innerHTML === '✓').length);
check('checked box rendered for [x] line', checkedBoxes >= 1, 'checked=' + checkedBoxes);
console.log('--- rendered text ---\n' + text.trim() + '\n');
await page.close();

// 2) Empty instructions → graceful message, not a crash.
page = await load('#t-empty');
text = await page.evaluate(() => document.getElementById('doc-content').innerText);
check('empty instructions shows friendly message', /No instructions yet/.test(text));
await page.close();

// 3) Unknown team id → not-found message.
page = await load('#t-nope');
text = await page.evaluate(() => document.getElementById('doc-content').innerText);
check('unknown team shows not-found message', /not be found|not found/i.test(text));
await page.close();

// 4) Legacy ?team= query param still resolves (backward-compat).
page = await load('?team=t-setup');
text = await page.evaluate(() => document.getElementById('doc-content').innerText);
check('legacy ?team= query resolves', /Serving Instructions/.test(text) && /Setup/.test(text));
await page.close();

await browser.close(); server.close();
console.log('\n===== INSTRUCTIONS PREVIEW: ' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') + ' =====');
process.exit(failures ? 1 : 0);
