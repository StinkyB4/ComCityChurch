/**
 * COMMISSIONED CITY CHURCH — MEDIA REGISTRY
 * ==========================================
 * This is the ONE file to edit for all media updates.
 *
 * TYPE OPTIONS:
 *   "image"      → single static image
 *   "slideshow"  → auto-advancing crossfade slideshow
 *   "video"      → looping muted background video (mp4)
 *
 * OVERLAY OPTIONS:
 *   overlay.type:  "none" | "dark" | "navy" | "gradient" | "color"
 *   overlay.opacity: 0.0 – 1.0
 *   overlay.direction (gradient only): "to-top" | "to-bottom" | "to-right" | "to-left" | "radial"
 *   overlay.color (color + gradient types): any CSS color string e.g. "#112E53"
 *
 * SLIDESHOW OPTIONS:
 *   interval      → ms between slides (default 5000)
 *   transition    → ms for crossfade (default 800)
 *   pauseOnHover  → true | false
 *
 * VIDEO OPTIONS:
 *   poster        → fallback image shown before video loads / on mobile
 *   loop          → true | false
 *   playbackRate  → 0.5–2.0 (default 1.0; use 0.75 for cinematic slow)
 *
 * UPDATING MEDIA — THE ONLY WORKFLOW:
 *   Swap image   → change the src: line
 *   Add slides   → change type to "slideshow", add slides: [{src, alt}]
 *   Add video    → change type to "video", set src + poster
 *   Add sermon   → add one object to SITE_MEDIA.sermons[]
 *   Adjust text  → change overlay.opacity (0.1 increments)
 */

// NOTE: All paths are root-absolute (/assets/...) so the registry resolves
// correctly from any page depth (root, /communities/, /members/, /blog/).
//
// PLACEHOLDER IMAGES — these keys currently reuse existing photography because
// the real photo has not been supplied yet. Swap in the real image when ready:
//   heroes.team   -> about-hero.jpg     heroes.visit -> contact-hero.jpg
//   heroes.give   -> communities-hero.jpg
//   (MC neighbourhood heroes reuse their matching community card photo.)
const SITE_MEDIA = {

  // ── HERO SECTIONS ──────────────────────────────────────────────────────────

  heroes: {

    home: {
      type: "slideshow",
      slides: [
        { src: "/assets/media/heroes/home-1.jpg", alt: "Sunday worship gathering" },
        { src: "/assets/media/heroes/home-2.jpg", alt: "Community life together" },
        { src: "/assets/media/heroes/home-3.jpg", alt: "Baptism celebration" },
        { src: "/assets/media/heroes/home-4.jpg", alt: "Baptism celebration" },
      ],
      interval: 6000,
      transition: 1000,
      pauseOnHover: false,
      overlay: {
        type: "dark",
        opacity: 0.55,
      }
    },

    about: {
      type: "image",
      src: "/assets/media/heroes/about-hero.jpg",
      alt: "Commissioned City Church",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.65,
      }
    },

    visit: {
      type: "image",
      src: "/assets/media/heroes/contact-hero.jpg",
      alt: "Welcome to Commissioned City Church",
      overlay: {
        type: "dark",
        opacity: 0.52,
      }
    },

    team: {
      type: "image",
      src: "/assets/media/heroes/about-hero.jpg",
      alt: "Our leadership team",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.65,
      }
    },

    believe: {
      type: "image",
      src: "/assets/media/heroes/believe-hero.jpg",
      alt: "Open Bible",
      overlay: {
        type: "navy",
        opacity: 0.2,
      }
    },

    gospel: {
      type: "image",
      src: "/assets/media/heroes/gospel-hero.jpg",
      alt: "The gospel",
      overlay: {
        type: "gradient",
        direction: "radial",
        color: "#000000",
        opacity: 0.80,
      }
    },

    // First Steps page. Reuses a home hero until a dedicated photo is dropped
    // in at /assets/media/heroes/first-steps-hero.jpg — swap the src below.
    "first-steps": {
      type: "image",
      src: "/assets/media/heroes/home-4.jpg",
      alt: "Taking a next step together",
      overlay: {
        type: "dark",
        opacity: 0.58,
      }
    },

    communities: {
      type: "image",
      src: "/assets/media/heroes/communities-hero.jpg",
      alt: "Missional community gathering",
      overlay: {
        type: "navy",
        opacity: 0.68,
      }
    },

    gatherings: {
      type: "video",
      src: "/assets/media/heroes/gatherings-bg.mp4",
      poster: "/assets/media/heroes/gatherings-poster.jpg",
      muted: true,
      loop: true,
      playbackRate: 0.80,
      overlay: {
        type: "dark",
        opacity: 0.50,
      }
    },

    sermons: {
      type: "image",
      src: "/assets/media/heroes/sermons-hero.jpg",
      alt: "Sermon teaching",
      overlay: {
        type: "navy",
        opacity: 0.75,
      }
    },

    give: {
      type: "image",
      src: "/assets/media/heroes/communities-hero.jpg",
      alt: "Generous giving",
      overlay: {
        type: "gradient",
        direction: "to-right",
        color: "#112E53",
        opacity: 0.70,
      }
    },

    contact: {
      type: "image",
      src: "/assets/media/heroes/contact-hero.jpg",
      alt: "Welcome — plan your visit",
      overlay: {
        type: "dark",
        opacity: 0.2,
      }
    },

    partnerships: {
      type: "image",
      src: "/assets/media/heroes/partnerships-hero.jpg",
      alt: "Our gospel partnerships",
      overlay: {
        type: "navy",
        opacity: 0.65,
      }
    },

    // ── MISSIONAL COMMUNITY SUB-PAGES ──────────────────────────────
    // NOTE: These pages live in communities/ (one level deep), so paths
    // use ../assets/ rather than assets/. Do not reference these keys
    // from any root-level page — the path will not resolve correctly.
    // When the site moves to a web server, update all paths below to
    // absolute paths (e.g. /assets/media/communities/south-osborne.jpg).
    // Until photos are ready, the CSS gradient on .mc-hero shows through
    // because a missing background-image renders transparently.

    "south-osborne": {
      type: "image",
      src: "/assets/media/communities/south-osborne.jpg",
      alt: "South Osborne neighbourhood",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "river-heights": {
      type: "image",
      src: "/assets/media/communities/river-heights.jpg",
      alt: "River Heights neighbourhood",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "st-james": {
      type: "image",
      src: "/assets/media/communities/st-james.jpg",
      alt: "St. James neighbourhood",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "youth": {
      type: "image",
      src: "/assets/media/communities/youth.jpg",
      alt: "Youth community gathering",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "moms-and-womens": {
      type: "image",
      src: "/assets/media/heroes/womens-hero.jpg",
      alt: "Women gathering together",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "mens-discipleship": {
      type: "image",
      src: "/assets/media/heroes/mens-hero.jpg",
      alt: "Men studying Scripture together",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    "womens-prayer": {
      type: "image",
      src: "/assets/media/heroes/womens_prayer-hero.jpg",
      alt: "Women in prayer",
      overlay: {
        type: "dark",
        opacity: 0.45,
      }
    },

    // ── BLOG PAGES ─────────────────────────────────────────────────
    // "blog" is used by blog.html (root level) — assets/ paths.
    // Post-level keys are used by blog/*.html (one level deep) — ../assets/ paths.
    // Same convention as communities/ sub-pages. Switch to absolute paths
    // (e.g. /assets/media/blog/...) when the site is deployed to a server.

    blog: {
      type: "image",
      src: "/assets/media/blog/post-missionary-servants.jpg",
      alt: "Resources — Blog",
      overlay: { type: "dark", opacity: 0.55 }
    },

    "blog-missionary-servants": {
      type: "image",
      src: "/assets/media/blog/post-missionary-servants.jpg",
      alt: "A Family of Missionary Servants",
      overlay: { type: "dark", opacity: 0.50 }
    },

    "blog-matthew-715": {
      type: "image",
      src: "/assets/media/blog/post-matthew-715.jpg",
      alt: "Matthew 7:15–29 — Hearing and Doing",
      overlay: { type: "dark", opacity: 0.50 }
    },

    "blog-gospel-fluency": {
      type: "image",
      src: "/assets/media/blog/post-gospel-fluency.jpg",
      alt: "Gospel Fluency",
      overlay: { type: "dark", opacity: 0.50 }
    },

    // PLACEHOLDER IMAGE — post-four-idols.jpg currently reuses the Gospel
    // Fluency photo. Swap in the real image at the same path when ready.
    "blog-four-idols": {
      type: "image",
      src: "/assets/media/blog/post-four-idols.jpg",
      alt: "The Four Idols: Control, Approval, Comfort, and Success",
      overlay: { type: "dark", opacity: 0.55 }
    },

    "blog-sabbath": {
      type: "image",
      src: "/assets/media/blog/post-sabbath.jpg",
      alt: "The Essence of Sabbath in the Body of Christ",
      overlay: { type: "dark", opacity: 0.50 }
    },

  },

  // ── CONTENT BLOCKS ─────────────────────────────────────────────────────────

  blocks: {
    welcome: {
      src: "/assets/media/blocks/welcome.jpg",
      alt: "Church community gathered",
      objectPosition: "center center",
    },
    gospelCoffee: {
      src: "/assets/media/blocks/gospel-coffee.jpg",
      alt: "Coffee and conversation",
      objectPosition: "center top",
    },
    gospelVisit: {
      src: "/assets/media/blocks/gospel-visit.jpg",
      alt: "Come and see",
      objectPosition: "center center",
    },
    beingBeforeDoing: {
      src: "/assets/media/blocks/being-before-doing.jpg",
      alt: "Identity Rooted in Jesus",
      objectPosition: "center center",
    },
  },

  // ── COMMUNITY CARDS ────────────────────────────────────────────────────────

  communities: {
    "south-osborne": {
      src: "/assets/media/communities/south-osborne.jpg",
      alt: "South Osborne neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.60,
      }
    },
    "river-heights": {
      src: "/assets/media/communities/river-heights.jpg",
      alt: "River Heights neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.60,
      }
    },
    "st-james": {
      src: "/assets/media/communities/st-james.jpg",
      alt: "St. James neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.65,
      }
    },
    "youth": {
      src: "/assets/media/communities/youth.jpg",
      alt: "Youth community",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.55,
      }
    },
    "moms-and-womens": {
      src: "/assets/media/heroes/womens-hero.jpg",
      alt: "Women's MC community",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.60,
      }
    },
    "mens-discipleship": {
      src: "/assets/media/heroes/mens-hero.jpg",
      alt: "Men's Discipleship Morning",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#30343B",
        opacity: 1.60,
      }
    },
    "womens-prayer": {
      src: "/assets/media/heroes/womens_prayer-hero.jpg",
      alt: "Women's Prayer Call",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 1.60,
      }
    },
  },

  // ── PARTNER LOGOS ──────────────────────────────────────────────────────────
  // Add new partners here. Use data-media="partners.key" on <img> tags in
  // partnerships.html and the renderer will set src + alt automatically.

  partners: {
    "ness-baptist": {
      src: "/assets/media/partners/ness-baptist.png",
      alt: "Ness Avenue Baptist Church",
    },
    "bgc-canada": {
      src: "/assets/media/partners/bgc-canada.png",
      alt: "Baptist General Conference of Canada",
    },
    "soma": {
      src: "/assets/media/partners/soma.jpg",
      alt: "SOMA Family of Churches",
    },
    "9marks": {
      src: "/assets/media/partners/9marks.jpg",
      alt: "9Marks",
    },
  },

  // ── TEAM PHOTOS ────────────────────────────────────────────────────────────

  team: {
    timothy: {
      src: "/assets/media/team/timothy-reeve.jpg",
      alt: "Timothy Reeve — Elder",
      objectPosition: "center top",
    },
    brennan: {
      src: "/assets/media/team/brennan-cattani.jpg",
      alt: "Brennan Cattani — Staff Elder",
      objectPosition: "center top",
    },
    caleb: {
      src: "/assets/media/team/caleb-mogilevsky.jpg",
      alt: "Caleb Mogilevsky — Deacon of Youth",
      objectPosition: "center top",
    },
    ethan: {
      src: "/assets/media/team/ethan-jones.jpg",
      alt: "Ethan Jones — Church Plant Resident",
      objectPosition: "center top",
    },
  },

  // ── SERMON THUMBNAILS ──────────────────────────────────────────────────────
  // Add objects here to add sermons to the grid on sermons.html

  sermons: [
    {
      id: "grace-alone",
      title: "Grace Alone",
      series: "Romans",
      reference: "Romans 3:21–31",
      speaker: "Timothy Reeve",
      date: "January 2025",
      thumb: "/assets/media/sermons/sermon-grace-alone.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "sent",
      title: "Sent",
      series: "The Great Commission",
      reference: "Matthew 28:18–20",
      speaker: "Brennan Cattani",
      date: "February 2025",
      thumb: "/assets/media/sermons/sermon-sent.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "church-gathered",
      title: "The Church Gathered",
      series: "Acts",
      reference: "Acts 2:42–47",
      speaker: "Timothy Reeve",
      date: "March 2025",
      thumb: "/assets/media/sermons/sermon-gathered.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "rooted-in-christ",
      title: "Rooted in Christ",
      series: "Colossians",
      reference: "Colossians 1:15–20",
      speaker: "Brennan Cattani",
      date: "April 2025",
      thumb: "/assets/media/sermons/sermon-rooted.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
  ],

};
