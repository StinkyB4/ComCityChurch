# UX/UI Self-Test Harness (Puppeteer)

Automated browser tests that load every key page of the site in **desktop,
tablet, and two mobile** viewports and check the real user experience.

## What it checks

For each page × viewport:

- **JS console errors** and uncaught exceptions
- **Failed network requests / 4xx-5xx** (local failures flagged; external
  offline failures noted separately, e.g. Google Fonts/Maps)
- **Horizontal overflow** measured against the *target* device width — this
  also catches mobile "shrink-to-fit" blow-outs that a naive
  `scrollWidth > innerWidth` check misses
- **Broken images** and **missing `alt`** text
- **Document basics**: title, single `<h1>`, `<html lang>`, viewport meta
- **Mobile nav**: hamburger visible, links hidden, opens, body scroll-locked,
  closes (auto-detected per width — tablet uses the mobile nav)
- **Desktop nav**: links visible, hamburger hidden
- **Tap targets** below the WCAG 2.5.8 minimum (24px) — icon buttons / links
- **Broken internal links** (resolved against disk, relative to each page)

It also **auto-scrolls** each page (to trigger scroll-in animations and lazy
media) and forces `.fade-in-up` content visible before screenshotting, so the
full-page captures reflect what a user actually sees.

## Viewports

| id          | size      | nav      |
|-------------|-----------|----------|
| `desktop`   | 1440×900  | full     |
| `tablet`    | 768×1024  | hamburger|
| `mobile`    | 390×844   | hamburger|
| `mobile-sm` | 360×640   | hamburger|

## Run it

```bash
cd tests/ux
npm install           # one-time: installs Puppeteer (downloads Chromium)
ITER=1 node run-tests.mjs
```

Output lands in `results/iteration-<ITER>/`:

- `report.md` — human-readable per-page findings
- `report.json` — machine-readable full results
- `screenshots/` — full-page PNGs, `<page>__<viewport>.png` (git-ignored)

A compact pass/fail summary is also printed to stdout.

`static-server.mjs` is a tiny zero-dependency static file server used by the
runner (serves the repo root; stubs `/api/*` so the sermon fetch falls through
to its client-side fallback quickly). Run it standalone for manual poking:

```bash
node static-server.mjs 8080   # http://127.0.0.1:8080
```
