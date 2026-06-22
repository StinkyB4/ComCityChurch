// =============================================================================
// Commissioned City Church — Puppeteer UX/UI self-test harness
//
// Loads every key page in DESKTOP and MOBILE viewports, then checks for:
//   - JS console errors / uncaught exceptions
//   - failed network requests & 4xx/5xx (local vs external classified)
//   - horizontal overflow (and the elements causing it)
//   - broken images & missing alt text
//   - document basics (title, single h1, lang, viewport meta)
//   - mobile nav open/close behavior; desktop nav visibility
//   - small tap targets on mobile
//   - broken internal links (disk-resolved crawl)
//
// Outputs JSON + Markdown report + full-page screenshots per iteration.
//
// Usage:  ITER=1 node run-tests.mjs
// =============================================================================

import puppeteer from 'puppeteer';
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(__dirname, '..', '..'));
const ITER = process.env.ITER || '0';
const OUT = join(__dirname, 'results', `iteration-${ITER}`);
const SHOTS = join(OUT, 'screenshots');

// ── Pages under test (user-facing journey) ──────────────────────────────────
const PAGES = [
  { path: '/index.html',                        name: 'home' },
  { path: '/about.html',                        name: 'about' },
  { path: '/team.html',                         name: 'team' },
  { path: '/believe.html',                      name: 'believe' },
  { path: '/gospel.html',                       name: 'gospel' },
  { path: '/partnerships.html',                 name: 'partnerships' },
  { path: '/communities.html',                  name: 'communities' },
  { path: '/communities/south-osborne.html',    name: 'community-south-osborne' },
  { path: '/communities/river-heights.html',    name: 'community-river-heights' },
  { path: '/communities/st-james.html',         name: 'community-st-james' },
  { path: '/communities/youth.html',            name: 'community-youth' },
  { path: '/gatherings.html',                   name: 'gatherings' },
  { path: '/visit.html',                        name: 'visit' },
  { path: '/sermons.html',                      name: 'sermons' },
  { path: '/blog.html',                         name: 'blog' },
  { path: '/give.html',                         name: 'give' },
  { path: '/contact.html',                      name: 'contact' },
  { path: '/members/',                          name: 'members-login' },
  { path: '/members/register.html',             name: 'members-register' },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
  { id: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { id: 'mobile-sm', width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' },
];

const isLocal = (url) => url.includes('127.0.0.1') || url.includes('localhost');

// ── In-page audit (runs inside the browser) ─────────────────────────────────
function pageAudit(targetWidth) {
  // Measure against the INTENDED width, not window.innerWidth: under mobile
  // emulation Chromium shrink-to-fits, expanding innerWidth to match overflow
  // and hiding it from a naive scrollWidth-vs-innerWidth check.
  const vw = targetWidth || window.innerWidth;
  const out = { overflow: null, innerWidth: window.innerWidth, shrinkToFit: 0,
                overflowElements: [], brokenImages: [], missingAlt: 0,
                title: document.title || '', h1Count: 0, lang: document.documentElement.lang || '',
                hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
                smallTapTargets: [], emptyLinks: 0 };

  // overflow (vs target width) + shrink-to-fit detection
  const sw = document.documentElement.scrollWidth;
  out.overflow = sw - vw;
  out.shrinkToFit = window.innerWidth - vw; // >1 => content forced layout wider than device
  if (out.overflow > 2 || out.shrinkToFit > 1) {
    const seen = new Set();
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width <= vw + 50 && r.width > 0) {
        const id = el.id ? `#${el.id}` : '';
        const cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '';
        const sig = `${el.tagName.toLowerCase()}${id}${cls}`;
        if (!seen.has(sig)) { seen.add(sig); out.overflowElements.push({ sel: sig, right: Math.round(r.right), width: Math.round(r.width) }); }
      }
    });
    out.overflowElements = out.overflowElements.slice(0, 12);
  }

  // h1
  out.h1Count = document.querySelectorAll('h1').length;

  // images
  document.querySelectorAll('img').forEach(img => {
    const r = img.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0;
    if (!img.hasAttribute('alt')) out.missingAlt++;
    if (img.complete && img.naturalWidth === 0 && visible) {
      out.brokenImages.push({ src: img.currentSrc || img.src, local: (img.src || '').includes('127.0.0.1') });
    }
  });

  // empty links
  document.querySelectorAll('a[href="#"]').forEach(() => out.emptyLinks++);

  // small tap targets — only flag BUTTONS and ICON-ONLY links (no text),
  // since ordinary inline text links are expected to be text-height.
  document.querySelectorAll('button, input[type=submit], input[type=button], [role=button], a').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return;
    const isAnchor = el.tagName === 'A';
    const hasText = (el.textContent || '').trim().length > 0;
    if (isAnchor && hasText) return; // skip normal text links
    if (r.width < 24 && r.height < 24) { // WCAG 2.5.8 minimum target size
      const id = el.id ? `#${el.id}` : '';
      const cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '';
      out.smallTapTargets.push({ sel: `${el.tagName.toLowerCase()}${id}${cls}`.slice(0,60), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent||'').trim().slice(0,24) });
    }
  });
  out.smallTapTargets = out.smallTapTargets.slice(0, 15);

  return out;
}

// Scroll the whole page (then back to top) to trigger scroll-based animations
// and lazy-loaded media before auditing / screenshotting.
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0; const step = 400;
      const timer = setInterval(() => {
        const h = document.documentElement.scrollHeight;
        window.scrollBy(0, step); total += step;
        if (total >= h + window.innerHeight) { clearInterval(timer); resolve(); }
      }, 60);
    });
    window.scrollTo(0, 0);
  });
}

async function testMobileNav(page) {
  const res = { hamburgerVisible: false, linksHidden: false, opens: false, bodyLocked: false, closes: false, error: null };
  try {
    const vis = await page.evaluate(() => {
      const h = document.querySelector('.nav-hamburger');
      const links = document.querySelector('.nav-links');
      const hr = h ? h.getBoundingClientRect() : null;
      const ls = links ? getComputedStyle(links) : null;
      return {
        hamburgerVisible: !!(hr && hr.width > 0 && hr.height > 0),
        linksHidden: !!(ls && (ls.display === 'none' || ls.visibility === 'hidden' || parseFloat(ls.opacity) === 0)),
      };
    });
    res.hamburgerVisible = vis.hamburgerVisible;
    res.linksHidden = vis.linksHidden;

    if (res.hamburgerVisible) {
      await page.click('.nav-hamburger');
      await new Promise(r => setTimeout(r, 350));
      const open = await page.evaluate(() => {
        const m = document.querySelector('.nav-mobile');
        const r = m ? m.getBoundingClientRect() : null;
        return { open: !!(m && m.classList.contains('open')), visible: !!(r && r.width > 0 && r.height > 0),
                 bodyLocked: getComputedStyle(document.body).overflow === 'hidden' };
      });
      res.opens = open.open && open.visible;
      res.bodyLocked = open.bodyLocked;

      // close via close button
      const hasClose = await page.$('.nav-mobile-close');
      if (hasClose) {
        await page.click('.nav-mobile-close');
        await new Promise(r => setTimeout(r, 350));
        res.closes = await page.evaluate(() => !document.querySelector('.nav-mobile').classList.contains('open'));
      }
    }
  } catch (e) { res.error = e.message; }
  return res;
}

async function testDesktopNav(page) {
  return page.evaluate(() => {
    const h = document.querySelector('.nav-hamburger');
    const links = document.querySelector('.nav-links');
    const hs = h ? getComputedStyle(h) : null;
    const lr = links ? links.getBoundingClientRect() : null;
    return {
      hamburgerHidden: !!(hs && (hs.display === 'none' || hs.visibility === 'hidden')),
      linksVisible: !!(lr && lr.width > 0 && lr.height > 0),
      dropdownCount: document.querySelectorAll('.nav-dropdown').length,
    };
  });
}

// ── Link integrity (disk-resolved, relative to each page's own directory) ────
async function crawlLinks(page, pagePath, results) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && !h.startsWith('http') && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('#') && !h.startsWith('javascript:'))
  );
  // directory of the current page (e.g. /communities/south-osborne.html -> /communities)
  const pageDir = pagePath.endsWith('/') ? pagePath : dirname(pagePath);
  for (const href of links) {
    const rel = href.split('?')[0].split('#')[0];
    if (!rel) continue;
    // Resolve "/..." from web root, everything else relative to the page dir.
    const target = rel.startsWith('/')
      ? normalize(join(ROOT, rel))
      : normalize(join(ROOT, pageDir, rel));
    try {
      const s = await stat(target);
      if (s.isDirectory()) await stat(join(target, 'index.html'));
    } catch {
      try { await stat(target + '.html'); } catch { results.add(`${pagePath} → ${href}`); }
    }
  }
}

async function run() {
  await mkdir(SHOTS, { recursive: true });
  const { server, port } = await startServer(0);
  const base = `http://127.0.0.1:${port}`;
  console.log(`[iter ${ITER}] server on ${base}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const report = { iteration: ITER, base, generatedAt: new Date().toISOString(), pages: [] };
  const brokenLinks = new Set();

  for (const pg of PAGES) {
    const pageEntry = { name: pg.name, path: pg.path, viewports: {} };
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setUserAgent(vp.ua);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });

      const consoleErrors = [], consoleWarnings = [], pageErrors = [], failedReq = [], httpErrors = [];
      page.on('console', m => {
        const t = m.type();
        const loc = (m.location() && m.location().url) || '';
        if (loc.includes('/api/')) return; // intentional stubbed-404 fallback
        if (t === 'error') consoleErrors.push(m.text());
        else if (t === 'warning' || t === 'warn') consoleWarnings.push(m.text());
      });
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('requestfailed', r => {
        const f = r.failure();
        failedReq.push({ url: r.url(), reason: f ? f.errorText : 'unknown', local: isLocal(r.url()) });
      });
      page.on('response', r => {
        // /api/* is intentionally stubbed 404 so the sermon fetch falls through
        if (r.url().includes('/api/')) return;
        if (r.status() >= 400) httpErrors.push({ url: r.url(), status: r.status(), local: isLocal(r.url()) });
      });

      let navOk = true, navMsg = '';
      try {
        await page.goto(base + pg.path, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e) { navOk = false; navMsg = e.message; }
      // settle initial media render
      await new Promise(r => setTimeout(r, 600));
      // scroll through page so IntersectionObserver fade-ins + lazy media trigger
      if (navOk) { try { await autoScroll(page); } catch {} }
      await new Promise(r => setTimeout(r, 800));
      // Force any remaining scroll-animation elements to their visible end-state
      // so the full-page screenshot reflects what a user sees after scrolling.
      if (navOk) {
        try { await page.addStyleTag({ content: '.fade-in-up{opacity:1 !important;transform:none !important;transition:none !important}' }); } catch {}
        await new Promise(r => setTimeout(r, 200));
      }

      const audit = navOk ? await page.evaluate(pageAudit, vp.width) : null;
      // Detect which nav is actually active at this width (hamburger visible?)
      let navTest = null, navMode = null;
      if (navOk) {
        const hambVisible = await page.evaluate(() => {
          const h = document.querySelector('.nav-hamburger');
          const r = h ? h.getBoundingClientRect() : null;
          return !!(r && r.width > 0 && r.height > 0);
        });
        navMode = hambVisible ? 'mobile' : 'desktop';
        navTest = hambVisible ? await testMobileNav(page) : await testDesktopNav(page);
      }

      if (vp.id === 'desktop') {
        try { await crawlLinks(page, pg.path, brokenLinks); } catch {}
      }

      // screenshot
      let shot = null;
      try {
        shot = `${pg.name}__${vp.id}.png`;
        await page.screenshot({ path: join(SHOTS, shot), fullPage: true });
      } catch (e) { shot = `ERROR: ${e.message}`; }

      pageEntry.viewports[vp.id] = {
        navOk, navMsg,
        consoleErrors, consoleWarnings, pageErrors,
        failedReq: failedReq.filter(f => f.local),
        failedReqExternal: failedReq.filter(f => !f.local).length,
        httpErrors: httpErrors.filter(h => h.local),
        audit, navTest, navMode, screenshot: shot,
      };
      await page.close();
    }
    report.pages.push(pageEntry);
    console.log(`[iter ${ITER}] tested ${pg.name}`);
  }

  report.brokenInternalLinks = [...brokenLinks];

  await browser.close();
  server.close();

  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(join(OUT, 'report.md'), renderMarkdown(report));
  console.log(`[iter ${ITER}] wrote ${join(OUT, 'report.md')}`);

  // print a compact summary to stdout for the harness
  console.log('\n===== SUMMARY =====');
  console.log(summarize(report));
}

function summarize(report) {
  const lines = [];
  let totalErr = 0, totalWarn = 0, totalOverflow = 0, totalBrokenImg = 0, totalLocalFail = 0, navIssues = 0, tapIssues = 0;
  for (const p of report.pages) {
    for (const [vid, v] of Object.entries(p.viewports)) {
      if (!v.audit) { lines.push(`!! ${p.name}/${vid}: NAV FAILED — ${v.navMsg}`); continue; }
      const errs = v.consoleErrors.length + v.pageErrors.length;
      totalErr += errs;
      totalWarn += v.consoleWarnings.length;
      totalLocalFail += v.failedReq.length + v.httpErrors.length;
      if (v.audit.overflow > 2 || v.audit.shrinkToFit > 1) { totalOverflow++; lines.push(`  overflow ${p.name}/${vid}: +${v.audit.overflow}px vs ${vid}${v.audit.shrinkToFit>1?` [shrink-to-fit innerW=${v.audit.innerWidth}]`:''} (${v.audit.overflowElements.map(e=>e.sel).join(', ')})`); }
      if (v.audit.brokenImages.filter(b=>b.local).length) { totalBrokenImg += v.audit.brokenImages.filter(b=>b.local).length; lines.push(`  broken-img ${p.name}/${vid}: ${v.audit.brokenImages.filter(b=>b.local).map(b=>b.src).join(', ')}`); }
      if (errs) lines.push(`  errors ${p.name}/${vid}: ${[...v.consoleErrors, ...v.pageErrors].join(' | ').slice(0,300)}`);
      if (v.failedReq.length) lines.push(`  local-fail ${p.name}/${vid}: ${v.failedReq.map(f=>f.url.replace(report.base,'')).join(', ')}`);
      if (v.httpErrors.length) lines.push(`  http-err ${p.name}/${vid}: ${v.httpErrors.map(h=>h.status+' '+h.url.replace(report.base,'')).join(', ')}`);
      if (v.navMode === 'mobile' && v.navTest) {
        const n = v.navTest;
        if (!n.hamburgerVisible || !n.linksHidden || !n.opens || !n.closes || !n.bodyLocked) {
          navIssues++; lines.push(`  mobile-nav ${p.name}/${vid}: hamburger=${n.hamburgerVisible} linksHidden=${n.linksHidden} opens=${n.opens} bodyLock=${n.bodyLocked} closes=${n.closes}`);
        }
      }
      if (v.navMode === 'desktop' && v.navTest && (!v.navTest.linksVisible || !v.navTest.hamburgerHidden)) {
        navIssues++; lines.push(`  desktop-nav ${p.name}/${vid}: linksVisible=${v.navTest.linksVisible} hamburgerHidden=${v.navTest.hamburgerHidden}`);
      }
      if (v.audit.smallTapTargets.length) tapIssues += v.audit.smallTapTargets.length;
      if (v.audit.h1Count !== 1) lines.push(`  h1count ${p.name}/${vid}: ${v.audit.h1Count}`);
    }
  }
  if (report.brokenInternalLinks.length) lines.push(`BROKEN INTERNAL LINKS: ${report.brokenInternalLinks.join(', ')}`);
  const head = `errors=${totalErr} warnings=${totalWarn} overflowPages=${totalOverflow} brokenLocalImg=${totalBrokenImg} localReqFail=${totalLocalFail} navIssues=${navIssues} smallTapTargets=${tapIssues} brokenLinks=${report.brokenInternalLinks.length}`;
  return head + '\n' + lines.join('\n');
}

function renderMarkdown(report) {
  const L = [];
  L.push(`# UX/UI Test Report — Iteration ${report.iteration}`);
  L.push(`Generated: ${report.generatedAt}`);
  L.push('');
  L.push('## Headline');
  L.push('```');
  L.push(summarize(report));
  L.push('```');
  L.push('');
  L.push('## Per-page detail');
  for (const p of report.pages) {
    L.push(`### ${p.name} — \`${p.path}\``);
    for (const [vid, v] of Object.entries(p.viewports)) {
      L.push(`**${vid}**`);
      if (!v.navOk) { L.push(`- ❌ navigation failed: ${v.navMsg}`); continue; }
      const a = v.audit;
      L.push(`- overflow vs ${vid}: ${a.overflow}px${(a.overflow>2||a.shrinkToFit>1)?` ⚠️${a.shrinkToFit>1?` [shrink-to-fit innerW=${a.innerWidth}]`:''} (${a.overflowElements.map(e=>`${e.sel}→${e.right}`).join(', ')})`:''}`);
      L.push(`- console errors: ${v.consoleErrors.length}${v.consoleErrors.length?` — ${v.consoleErrors.join(' | ').slice(0,300)}`:''}`);
      L.push(`- page errors: ${v.pageErrors.length}${v.pageErrors.length?` — ${v.pageErrors.join(' | ').slice(0,300)}`:''}`);
      if (v.consoleWarnings.length) L.push(`- warnings: ${v.consoleWarnings.length} — ${v.consoleWarnings.join(' | ').slice(0,300)}`);
      if (v.failedReq.length) L.push(`- local failed requests: ${v.failedReq.map(f=>f.url.replace(report.base,'')+' ('+f.reason+')').join(', ')}`);
      if (v.httpErrors.length) L.push(`- local HTTP errors: ${v.httpErrors.map(h=>h.status+' '+h.url.replace(report.base,'')).join(', ')}`);
      if (v.failedReqExternal) L.push(`- external requests failed (offline/network, not a site bug): ${v.failedReqExternal}`);
      const localBroken = a.brokenImages.filter(b=>b.local);
      if (localBroken.length) L.push(`- ⚠️ broken local images: ${localBroken.map(b=>b.src.replace(report.base,'')).join(', ')}`);
      if (a.missingAlt) L.push(`- images missing alt: ${a.missingAlt}`);
      if (a.h1Count !== 1) L.push(`- ⚠️ h1 count: ${a.h1Count} (should be 1)`);
      if (!a.hasViewportMeta) L.push(`- ⚠️ missing viewport meta`);
      if (!a.lang) L.push(`- ⚠️ missing <html lang>`);
      if (v.navMode === 'mobile' && v.navTest) {
        const n = v.navTest;
        const ok = n.hamburgerVisible && n.linksHidden && n.opens && n.closes && n.bodyLocked;
        L.push(`- mobile nav: ${ok?'✅':'⚠️'} hamburgerVisible=${n.hamburgerVisible} linksHidden=${n.linksHidden} opens=${n.opens} bodyLocked=${n.bodyLocked} closes=${n.closes}`);
      }
      if (v.navMode === 'desktop' && v.navTest) {
        L.push(`- desktop nav: linksVisible=${v.navTest.linksVisible} hamburgerHidden=${v.navTest.hamburgerHidden} dropdowns=${v.navTest.dropdownCount}`);
      }
      if (a.smallTapTargets.length) L.push(`- small tap targets (<24px both dims): ${a.smallTapTargets.map(t=>`${t.sel}[${t.w}x${t.h}]`).join(', ')}`);
      L.push(`- screenshot: \`screenshots/${v.screenshot}\``);
    }
    L.push('');
  }
  if (report.brokenInternalLinks.length) {
    L.push('## ❌ Broken internal links');
    report.brokenInternalLinks.forEach(l => L.push(`- ${l}`));
  } else {
    L.push('## ✅ No broken internal links');
  }
  return L.join('\n');
}

run().catch(e => { console.error(e); process.exit(1); });
