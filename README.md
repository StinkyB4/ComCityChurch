# Commissioned City Church — Website

Static site deployed to **Azure Static Web Apps**.  
9 pages · Pure HTML/CSS/JS · No build tools · No frameworks.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [Pages](#pages)
3. [Media System Overview](#media-system-overview)
4. [Adding & Swapping Photos](#adding--swapping-photos)
5. [Hero Video Backgrounds](#hero-video-backgrounds)
6. [YouTube Hero Backgrounds](#youtube-hero-backgrounds)
7. [Live Stream on Sunday](#live-stream-on-sunday)
8. [Team Photos](#team-photos)
9. [Sermon Grid](#sermon-grid)
10. [Overlay Reference](#overlay-reference)
11. [Deployment](#deployment)
12. [Known Limitations](#known-limitations)

---

## File Structure

```
/
├── index.html
├── about.html
├── believe.html
├── gospel.html
├── communities.html
├── gatherings.html
├── sermons.html
├── give.html
├── contact.html
│
├── css/
│   └── styles.css              ← shared styles (never edit for media)
│
├── js/
│   ├── media.js                ← THE ONLY FILE TO EDIT FOR MEDIA UPDATES
│   └── main.js                 ← shared JS + MediaRenderer + YouTubeHeroPlayer
│
├── assets/
│   ├── logo.png
│   └── media/
│       ├── heroes/             ← full-bleed hero backgrounds
│       │   ├── home-1.jpg
│       │   ├── home-2.jpg
│       │   ├── home-3.jpg
│       │   ├── about-hero.jpg
│       │   ├── believe-hero.jpg
│       │   ├── gospel-hero.jpg
│       │   ├── communities-hero.jpg
│       │   ├── gatherings-bg.mp4
│       │   ├── gatherings-poster.jpg
│       │   ├── sermons-hero.jpg
│       │   ├── give-hero.jpg
│       │   └── contact-hero.jpg
│       ├── blocks/             ← section-level content images
│       │   ├── welcome.jpg
│       │   ├── gospel-coffee.jpg
│       │   ├── gospel-visit.jpg
│       │   └── being-before-doing.jpg
│       ├── communities/        ← community card backgrounds
│       │   ├── south-osborne.jpg
│       │   ├── river-heights.jpg
│       │   ├── st-james.jpg
│       │   └── youth.jpg
│       ├── team/               ← staff headshots
│       │   ├── timothy-reeve.jpg
│       │   ├── brennan-cattani.jpg
│       │   ├── caleb-mogilevsky.jpg
│       │   └── ethan-jones.jpg
│       └── sermons/            ← sermon card thumbnails
│           ├── sermon-grace-alone.jpg
│           ├── sermon-sent.jpg
│           ├── sermon-gathered.jpg
│           └── sermon-rooted.jpg
│
├── staticwebapp.config.json    ← Azure routing + security headers
└── .github/
    └── workflows/
        └── azure-deploy.yml    ← CI/CD: push to main → auto-deploy
```

---

## Pages

| URL | File | Notes |
|-----|------|-------|
| `/` | `index.html` | Homepage — slideshow hero, mission cards, communities preview |
| `/about` | `about.html` | Team grid, Being Before Doing, partnerships |
| `/believe` | `believe.html` | 15 doctrine sections |
| `/gospel` | `gospel.html` | Gospel narrative + response CTAs |
| `/communities` | `communities.html` | 4 Missional Community cards |
| `/gatherings` | `gatherings.html` | Sunday service info + map |
| `/sermons` | `sermons.html` | Spotify link + sermon grid |
| `/give` | `give.html` | Giving options + scripture |
| `/contact` | `contact.html` | Visit info + contact form |

> **Clean URLs** are handled by `staticwebapp.config.json` — `.html` extensions are never visible in the browser.

---

## Media System Overview

### The golden rule

**`js/media.js` is the only file you ever edit for media updates.**  
No HTML files need to be touched. Drop the file into `assets/media/`, update one line in `media.js`, push to GitHub. Done.

### How it works

Every hero section and media block in the HTML has a `data-media="key.path"` attribute pointing to an entry in `SITE_MEDIA` inside `media.js`. When the page loads, `MediaRenderer` reads that registry and injects the correct background — image, slideshow, or video — along with the specified overlay.

If a referenced file doesn't exist yet, the element falls back gracefully to its CSS gradient or background colour. Nothing breaks.

### Media types

| Type | Description |
|------|-------------|
| `"image"` | Single static photo as a background |
| `"slideshow"` | Auto-advancing crossfade between multiple photos |
| `"video"` | Looping muted local MP4 file |
| `"youtube"` | Muted YouTube video or live stream as a background |

---

## Adding & Swapping Photos

### Swap a single hero photo

1. Drop the new file into `assets/media/heroes/`
2. Open `js/media.js`
3. Find the page hero (e.g. `gatherings:`) and update the `src:` line:

```js
gatherings: {
  type: "image",
  src: "assets/media/heroes/gatherings-hero.jpg",   // ← change this line
  alt: "Sunday gathering",
  overlay: { type: "dark", opacity: 0.50 }
}
```

### Turn a static hero into a slideshow

1. Drop 2–4 photos into `assets/media/heroes/`
2. In `media.js`, change the hero entry:

```js
home: {
  type: "slideshow",
  slides: [
    { src: "assets/media/heroes/home-1.jpg", alt: "Sunday worship" },
    { src: "assets/media/heroes/home-2.jpg", alt: "Community life" },
    { src: "assets/media/heroes/home-3.jpg", alt: "Baptism" },
  ],
  interval: 6000,       // ms between slides
  transition: 1000,     // ms for crossfade
  pauseOnHover: false,
  overlay: { type: "dark", opacity: 0.55 }
}
```

### Swap a community card photo

1. Drop the photo into `assets/media/communities/`
2. Update the `src:` line under `communities:` in `media.js`:

```js
communities: {
  "south-osborne": {
    src: "assets/media/communities/south-osborne.jpg",   // ← change this
    alt: "South Osborne neighbourhood",
    overlay: { type: "gradient", direction: "to-top", color: "#112E53", opacity: 0.60 }
  },
  ...
}
```

### Recommended image sizes

| Location | Size | Format |
|----------|------|--------|
| Hero backgrounds | 1920 × 1080 px minimum | JPG, 80–90% quality |
| Community cards | 800 × 600 px minimum | JPG |
| Team headshots | 400 × 400 px (square crop) | JPG |
| Sermon thumbnails | 800 × 450 px (16:9) | JPG |
| Block images | 1000 × 800 px minimum | JPG |

---

## Hero Video Backgrounds

For a looping muted MP4 background on any hero:

1. Place the `.mp4` file in `assets/media/heroes/`
2. Place a poster `.jpg` (first frame or key image) in the same folder
3. Update `media.js`:

```js
gatherings: {
  type: "video",
  src: "assets/media/heroes/gatherings-bg.mp4",
  poster: "assets/media/heroes/gatherings-poster.jpg",  // shown while loading
  muted: true,
  loop: true,
  playbackRate: 0.80,   // 0.75–0.85 for cinematic slow motion
  overlay: { type: "dark", opacity: 0.50 }
}
```

**Tips:**
- Keep MP4 files under 8 MB. Compress with HandBrake (H.264, CRF 28, AAC audio can be stripped).
- Always provide a `poster:` — it shows on mobile and while the video buffers.
- `playbackRate: 0.80` gives a subtle slow-motion feel without needing a separately shot slow-mo clip.

---

## YouTube Hero Backgrounds

Use a YouTube video (or live stream) as a fullscreen muted background — no controls visible, no YouTube branding shown.

### Finding your YouTube ID

```
https://www.youtube.com/watch?v=ABC123XYZ12  →  "ABC123XYZ12"
https://youtu.be/ABC123XYZ12               →  "ABC123XYZ12"
```
The ID is always the 11-character string after `v=` or after the final `/`.

### Setting up a YouTube hero

```js
gatherings: {
  type: "youtube",
  youtubeId: "ABC123XYZ12",   // ← your video ID
  isLive: false,
  startSeconds: 30,           // skip past any intro (0 to start from beginning)
  poster: "assets/media/heroes/gatherings-poster.jpg",
  overlay: { type: "dark", opacity: 0.48 }
}
```

### Before it will work — enable embedding

YouTube videos must have embedding enabled or the player will silently fall back to the poster image.

1. Go to **YouTube Studio**
2. Open the video → **Details** → **More options**
3. Under *License and distribution*, tick **Allow embedding**
4. Save

For live streams: **Stream settings → Allow embedding**.

---

## Live Stream on Sunday

The recommended pattern is to keep two entries for the home hero and swap between them by changing **one line** in `media.js`.

```js
home: {

  // ── MON–SAT: photo slideshow ──────────────────────────────────
  type: "slideshow",
  slides: [
    { src: "assets/media/heroes/home-1.jpg", alt: "Sunday worship" },
    { src: "assets/media/heroes/home-2.jpg", alt: "Community life" },
    { src: "assets/media/heroes/home-3.jpg", alt: "Baptism" },
  ],
  interval: 6000,
  transition: 1000,
  overlay: { type: "dark", opacity: 0.55 }

  // ── SUNDAY LIVE: uncomment this, comment out the slideshow above
  // type: "youtube",
  // youtubeId: "YOUR_PERMANENT_LIVE_STREAM_ID",
  // isLive: true,
  // startSeconds: 0,
  // poster: "assets/media/heroes/home-live-poster.jpg",
  // overlay: { type: "navy", opacity: 0.42 }

}
```

**Saturday night:** uncomment the YouTube block, comment out the slideshow, `git push` → live in ~60 seconds.  
**Sunday afternoon:** reverse it.

> This is intentionally manual. One line change, one push — no automation that could accidentally put the wrong thing live.

### Finding your live stream ID

1. Go to **YouTube Studio → Go Live**
2. Copy the URL from the stream page — it contains an 11-character ID
3. Save it permanently — the same ID is reused for every future stream on that channel

---

## Team Photos

Team headshots are referenced under `team:` in `media.js`.

1. Crop each photo to a square (400 × 400 px recommended)
2. Save to `assets/media/team/` with the filename matching the entry:

```
assets/media/team/timothy-reeve.jpg
assets/media/team/brennan-cattani.jpg
assets/media/team/caleb-mogilevsky.jpg
assets/media/team/ethan-jones.jpg
```

3. The `objectPosition` setting controls crop focus:

```js
team: {
  timothy: {
    src: "assets/media/team/timothy-reeve.jpg",
    alt: "Timothy Reeve — Elder",
    objectPosition: "center top",   // "center top" keeps the face in frame
  },
  ...
}
```

When a photo is present, the initials placeholder (e.g. "TR") is automatically hidden. If the file is missing, the navy circle with initials shows as a fallback.

---

## Sermon Grid

The sermon grid on `sermons.html` is driven entirely by the `sermons:` array in `media.js`. No HTML editing needed.

### Adding a new sermon

1. Drop the thumbnail into `assets/media/sermons/`
2. Add one object to the `sermons:` array in `media.js`:

```js
sermons: [
  // existing sermons...
  {
    id: "new-sermon-id",
    title: "Sermon Title",
    series: "Series Name",
    reference: "Book 1:1–10",
    speaker: "Speaker Name",
    date: "May 2026",
    thumb: "assets/media/sermons/sermon-new.jpg",
    spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
  },
],
```

The grid rebuilds automatically on page load. Most recent sermons should go at the **top** of the array.

If no thumbnail exists yet, the card shows a navy gradient placeholder — perfectly fine until the image is ready.

---

## Overlay Reference

Every `data-media` entry can include an overlay that sits between the background and the page content, ensuring text is always readable.

### Types

```js
// Clean dark — text always readable, colour-neutral
overlay: { type: "dark", opacity: 0.52 }

// Brand immersion — navy tint reinforces CCC identity
overlay: { type: "navy", opacity: 0.68 }

// Any custom colour
overlay: { type: "color", color: "#D5393B", opacity: 0.45 }

// Gradient — most elegant, fades from colour to transparent
overlay: { type: "gradient", direction: "to-top",    color: "#000000", opacity: 0.72 }
overlay: { type: "gradient", direction: "to-bottom", color: "#112E53", opacity: 0.65 }
overlay: { type: "gradient", direction: "to-right",  color: "#112E53", opacity: 0.80 }
overlay: { type: "gradient", direction: "to-left",   color: "#112E53", opacity: 0.80 }
overlay: { type: "gradient", direction: "radial",    color: "#000000", opacity: 0.55 }

// No overlay — only when the photo is dark enough on its own
overlay: { type: "none" }
```

### Adjusting readability

If hero text is hard to read, increase `opacity` in 0.05 increments until it's clear. If the photo feels too buried, decrease it.

```js
overlay: { type: "dark", opacity: 0.40 }  // lighter — photo more visible
overlay: { type: "dark", opacity: 0.65 }  // heavier — text more readable
```

---

## Deployment

The site deploys automatically to **Azure Static Web Apps** on every push to `main`.

### Setup (one-time)

1. In the Azure Portal, open the Static Web App → **Manage deployment token** → copy the token
2. In GitHub → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: the token you copied
3. Push anything to `main` — the workflow in `.github/workflows/azure-deploy.yml` fires automatically

### Workflow behaviour

| Trigger | Result |
|---------|--------|
| Push to `main` | Full deploy to production |
| Pull request opened | Preview environment created (unique URL) |
| Pull request closed | Preview environment torn down |

### Manual deploy check

In your GitHub repo → **Actions** tab → click the latest workflow run to see logs.

---

## Known Limitations

### YouTube backgrounds

**Embedding must be enabled** on every YouTube video used as a background. If it's off, the player fires error code 101/150 and falls back silently to the poster image.  
→ YouTube Studio → Video details → More options → tick *Allow embedding*.

**Ad blockers** may prevent the YouTube IFrame API from loading entirely. The poster image shows instead — users never see a broken page.

**Mobile** — YouTube backgrounds are intentionally disabled on screens under 768 px wide. The poster image shows instead. This is correct behaviour: autoplay video on mobile consumes data and is blocked by iOS Safari anyway.

**Live stream latency** — YouTube live streams have 5–30 seconds of latency. This is fine for a decorative background.

### Contact form

The contact form on `/contact` is HTML-only — it has no backend. Submissions do not currently send anywhere. To wire it up, connect it to a form service:
- **Formspree** — free tier, no code required, just change `action="#"` to your Formspree endpoint
- **Netlify Forms** — if you ever migrate hosting
- **Azure Functions** — if you want a custom backend on the existing Azure infrastructure

### Social media links

Instagram and Facebook links in the nav and footer currently point to `href="#"`. Replace with real URLs when accounts are set up.

### Give Online button

The *Give Online* button on `/give` points to `href="#"`. Replace with your payment processor URL (Tithe.ly, Pushpay, Canada Helps, etc.).

---

*Matthew 28:18–20 · Commissioned City Church · Winnipeg, Manitoba*
