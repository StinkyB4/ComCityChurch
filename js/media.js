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

const SITE_MEDIA = {

  // ── HERO SECTIONS ──────────────────────────────────────────────────────────

  heroes: {

    home: {
      type: "slideshow",
      slides: [
        { src: "assets/media/heroes/home-1.jpg", alt: "Sunday worship gathering" },
        { src: "assets/media/heroes/home-2.jpg", alt: "Community life together" },
        { src: "assets/media/heroes/home-3.jpg", alt: "Baptism celebration" },
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
      src: "assets/media/heroes/about-hero.jpg",
      alt: "Our team",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 0.65,
      }
    },

    believe: {
      type: "image",
      src: "assets/media/heroes/believe-hero.jpg",
      alt: "Open Bible",
      overlay: {
        type: "navy",
        opacity: 0.72,
      }
    },

    gospel: {
      type: "image",
      src: "assets/media/heroes/gospel-hero.jpg",
      alt: "The gospel",
      overlay: {
        type: "gradient",
        direction: "radial",
        color: "#000000",
        opacity: 0.60,
      }
    },

    communities: {
      type: "image",
      src: "assets/media/heroes/communities-hero.jpg",
      alt: "Missional community gathering",
      overlay: {
        type: "navy",
        opacity: 0.68,
      }
    },

    gatherings: {
      type: "video",
      src: "assets/media/heroes/gatherings-bg.mp4",
      poster: "assets/media/heroes/gatherings-poster.jpg",
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
      src: "assets/media/heroes/sermons-hero.jpg",
      alt: "Sermon teaching",
      overlay: {
        type: "navy",
        opacity: 0.75,
      }
    },

    give: {
      type: "image",
      src: "assets/media/heroes/give-hero.jpg",
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
      src: "assets/media/heroes/contact-hero.jpg",
      alt: "Welcome — plan your visit",
      overlay: {
        type: "dark",
        opacity: 0.52,
      }
    },

  },

  // ── CONTENT BLOCKS ─────────────────────────────────────────────────────────

  blocks: {
    welcome: {
      src: "assets/media/blocks/welcome.jpg",
      alt: "Church community gathered",
      objectPosition: "center center",
    },
    gospelCoffee: {
      src: "assets/media/blocks/gospel-coffee.jpg",
      alt: "Coffee and conversation",
      objectPosition: "center top",
    },
    gospelVisit: {
      src: "assets/media/blocks/gospel-visit.jpg",
      alt: "Come and see",
      objectPosition: "center center",
    },
    beingBeforeDoing: {
      src: "assets/media/blocks/being-before-doing.jpg",
      alt: "Rooted in identity",
      objectPosition: "center center",
    },
  },

  // ── COMMUNITY CARDS ────────────────────────────────────────────────────────

  communities: {
    "south-osborne": {
      src: "assets/media/communities/south-osborne.jpg",
      alt: "South Osborne neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 0.60,
      }
    },
    "river-heights": {
      src: "assets/media/communities/river-heights.jpg",
      alt: "River Heights neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#30343B",
        opacity: 0.60,
      }
    },
    "st-james": {
      src: "assets/media/communities/st-james.jpg",
      alt: "St. James neighbourhood",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#112E53",
        opacity: 0.65,
      }
    },
    "youth": {
      src: "assets/media/communities/youth.jpg",
      alt: "Youth community",
      overlay: {
        type: "gradient",
        direction: "to-top",
        color: "#D5393B",
        opacity: 0.55,
      }
    },
  },

  // ── TEAM PHOTOS ────────────────────────────────────────────────────────────

  team: {
    timothy: {
      src: "assets/media/team/timothy-reeve.jpg",
      alt: "Timothy Reeve — Elder",
      objectPosition: "center top",
    },
    brennan: {
      src: "assets/media/team/brennan-cattani.jpg",
      alt: "Brennan Cattani — Staff Elder",
      objectPosition: "center top",
    },
    caleb: {
      src: "assets/media/team/caleb-mogilevsky.jpg",
      alt: "Caleb Mogilevsky — Deacon of Youth",
      objectPosition: "center top",
    },
    ethan: {
      src: "assets/media/team/ethan-jones.jpg",
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
      thumb: "assets/media/sermons/sermon-grace-alone.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "sent",
      title: "Sent",
      series: "The Great Commission",
      reference: "Matthew 28:18–20",
      speaker: "Brennan Cattani",
      date: "February 2025",
      thumb: "assets/media/sermons/sermon-sent.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "church-gathered",
      title: "The Church Gathered",
      series: "Acts",
      reference: "Acts 2:42–47",
      speaker: "Timothy Reeve",
      date: "March 2025",
      thumb: "assets/media/sermons/sermon-gathered.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
    {
      id: "rooted-in-christ",
      title: "Rooted in Christ",
      series: "Colossians",
      reference: "Colossians 1:15–20",
      speaker: "Brennan Cattani",
      date: "April 2025",
      thumb: "assets/media/sermons/sermon-rooted.jpg",
      spotifyUrl: "https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ",
    },
  ],

};
