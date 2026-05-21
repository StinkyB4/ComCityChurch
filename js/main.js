/* =============================================
   COMMISSIONED CITY CHURCH — SHARED JS
   ============================================= */

// 1. ACTIVE NAV LINK
(function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

// 2. STICKY NAV SHADOW
(function stickyNav() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
})();

// 3. MOBILE HAMBURGER MENU
(function mobileMenu() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.querySelector('.nav-mobile');
  const closeBtn  = document.querySelector('.nav-mobile-close');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    mobileNav.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  function closeMenu() {
    mobileNav.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });
})();

// 4. FADE-IN-UP ON SCROLL (IntersectionObserver)
(function fadeInOnScroll() {
  const els = document.querySelectorAll('.fade-in-up');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
})();

// ── MEDIA RENDERER ─────────────────────────────────────────────────────────

class MediaRenderer {

  constructor() {
    this.activeSlideshows = [];
    this.init();
  }

  init() {
    document.querySelectorAll('[data-media]').forEach(el => {
      const keyPath = el.dataset.media;
      const mediaData = this.resolve(keyPath);
      if (!mediaData) {
        console.warn(`[MediaRenderer] No media found for key: "${keyPath}"`);
        return;
      }
      this.render(el, mediaData);
    });

    const sermonGrid = document.getElementById('sermon-grid');
    if (sermonGrid && SITE_MEDIA.sermons) {
      this.renderSermonGrid(sermonGrid);
    }
  }

  resolve(path) {
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : null;
    }, SITE_MEDIA);
  }

  render(el, data) {
    const type = data.type || 'image';
    el.classList.add('media-container');

    switch (type) {
      case 'slideshow': this.renderSlideshow(el, data); break;
      case 'video':     this.renderVideo(el, data);     break;
      case 'image':     this.renderImage(el, data);     break;
      case 'youtube': {
        const ytPlayer = new YouTubeHeroPlayer(el, data);
        el._ytPlayerInstance = ytPlayer;
        break;
      }
      default: this.renderImage(el, data);
    }

    if (data.overlay && data.overlay.type !== 'none') {
      this.applyOverlay(el, data.overlay);
    }
  }

  // ── SINGLE IMAGE ───────────────────────────────────────────────

  renderImage(el, data) {
    if (el.tagName === 'IMG') {
      el.src = data.src;
      el.alt = data.alt || '';
      if (data.objectPosition) el.style.objectPosition = data.objectPosition;
      return;
    }
    const layer = document.createElement('div');
    layer.className = 'media-bg media-image';
    layer.style.backgroundImage = `url('${data.src}')`;
    if (data.objectPosition) layer.style.backgroundPosition = data.objectPosition;
    layer.setAttribute('role', 'img');
    layer.setAttribute('aria-label', data.alt || '');
    el.insertBefore(layer, el.firstChild);
  }

  // ── SLIDESHOW ──────────────────────────────────────────────────

  renderSlideshow(el, data) {
    const slides = data.slides || [];
    if (slides.length === 0) return;

    const interval   = data.interval   || 5000;
    const transition = data.transition || 800;
    const pauseOnHover = data.pauseOnHover !== false;

    const slideWrapper = document.createElement('div');
    slideWrapper.className = 'media-bg media-slideshow';

    slides.forEach((slide, i) => {
      const layer = document.createElement('div');
      layer.className = 'slide-layer' + (i === 0 ? ' is-active' : '');
      layer.style.backgroundImage = `url('${slide.src}')`;
      layer.style.transitionDuration = `${transition}ms`;
      layer.setAttribute('aria-label', slide.alt || '');
      slideWrapper.appendChild(layer);
    });

    const dots = document.createElement('div');
    dots.className = 'slideshow-dots';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'slideshow-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dots.appendChild(dot);
    });

    el.insertBefore(slideWrapper, el.firstChild);
    el.appendChild(dots);

    let current = 0;
    let timer = null;

    const getLayers = () => slideWrapper.querySelectorAll('.slide-layer');
    const getDots   = () => dots.querySelectorAll('.slideshow-dot');

    const goTo = (index) => {
      getLayers()[current].classList.remove('is-active');
      getDots()[current].classList.remove('is-active');
      current = (index + slides.length) % slides.length;
      getLayers()[current].classList.add('is-active');
      getDots()[current].classList.add('is-active');
    };

    const startTimer = () => { timer = setInterval(() => goTo(current + 1), interval); };
    const stopTimer  = () => { clearInterval(timer); };

    startTimer();

    if (pauseOnHover) {
      el.addEventListener('mouseenter', stopTimer);
      el.addEventListener('mouseleave', startTimer);
    }

    requestAnimationFrame(() => {
      slides.slice(1).forEach(slide => { const img = new Image(); img.src = slide.src; });
    });

    this.activeSlideshows.push({ el, goTo, startTimer, stopTimer });
  }

  // ── VIDEO BACKGROUND ───────────────────────────────────────────

  renderVideo(el, data) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const wrapper = document.createElement('div');
    wrapper.className = 'media-bg media-video-wrapper';

    if (prefersReducedMotion && data.poster) {
      wrapper.style.backgroundImage = `url('${data.poster}')`;
      el.insertBefore(wrapper, el.firstChild);
      return;
    }

    const video = document.createElement('video');
    video.className   = 'media-video';
    video.src         = data.src;
    video.muted       = true;
    video.loop        = data.loop !== false;
    video.autoplay    = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    if (data.poster) video.poster = data.poster;
    if (data.playbackRate) {
      video.addEventListener('loadeddata', () => { video.playbackRate = data.playbackRate; });
    }

    wrapper.appendChild(video);
    el.insertBefore(wrapper, el.firstChild);

    video.play().catch(() => {
      if (data.poster) {
        wrapper.className = 'media-bg media-image';
        wrapper.style.backgroundImage = `url('${data.poster}')`;
        wrapper.removeChild(video);
      }
    });
  }

  // ── OVERLAY ENGINE ─────────────────────────────────────────────

  applyOverlay(el, overlay) {
    const type      = overlay.type      || 'dark';
    const opacity   = overlay.opacity   ?? 0.5;
    const color     = overlay.color     || '#000000';
    const direction = overlay.direction || 'to-top';

    const div = document.createElement('div');
    div.className = 'media-overlay';
    div.setAttribute('aria-hidden', 'true');

    switch (type) {
      case 'dark':
        div.style.background = `rgba(0, 0, 0, ${opacity})`;
        break;
      case 'navy':
        div.style.background = `rgba(17, 46, 83, ${opacity})`;
        break;
      case 'color':
        div.style.background = this.hexToRgba(color, opacity);
        break;
      case 'gradient': {
        const rgba        = this.hexToRgba(color, opacity);
        const transparent = this.hexToRgba(color, 0);
        const map = {
          'to-top':    `linear-gradient(to top,    ${rgba} 0%, ${transparent} 100%)`,
          'to-bottom': `linear-gradient(to bottom, ${rgba} 0%, ${transparent} 100%)`,
          'to-right':  `linear-gradient(to right,  ${rgba} 0%, ${transparent} 100%)`,
          'to-left':   `linear-gradient(to left,   ${rgba} 0%, ${transparent} 100%)`,
          'radial':    `radial-gradient(ellipse at center, ${rgba} 0%, ${transparent} 70%)`,
        };
        div.style.background = map[direction] || map['to-top'];
        break;
      }
      default:
        div.style.background = `rgba(0, 0, 0, ${opacity})`;
    }

    el.appendChild(div);
  }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ── SERMON GRID ────────────────────────────────────────────────

  renderSermonGrid(container) {
    container.innerHTML = '';
    SITE_MEDIA.sermons.forEach(sermon => {
      const hasThumb = sermon.thumb && sermon.thumb.length > 0;
      const thumbStyle = hasThumb
        ? `background-image: url('${sermon.thumb}'); background-size:cover; background-position:center;`
        : `background: linear-gradient(135deg, var(--navy) 0%, var(--muted-blue) 100%);`;

      const card = document.createElement('article');
      card.className = 'sermon-card';
      card.innerHTML = `
        <div class="sermon-thumb" style="${thumbStyle}">
          <span class="sermon-series-badge">${sermon.series}</span>
        </div>
        <div class="sermon-body">
          <p class="sermon-reference eyebrow">${sermon.reference}</p>
          <h4 class="sermon-title">${sermon.title}</h4>
          <p class="sermon-meta">${sermon.speaker} &nbsp;·&nbsp; ${sermon.date}</p>
          <a href="${sermon.spotifyUrl}" class="sermon-listen" target="_blank" rel="noopener noreferrer">Listen on Spotify →</a>
        </div>
      `;
      container.appendChild(card);
    });
  }

}

// ── YOUTUBE HERO PLAYER ───────────────────────────────────────────────────
//
// Renders a YouTube video (or live stream) as a fullscreen muted background.
// Controls and letterboxing are hidden by the oversized iframe + overflow:hidden.
// Falls back to poster image on mobile, reduced-motion, slow connections,
// ad-blockers, or embedding-disabled videos.

class YouTubeHeroPlayer {

  constructor(el, data) {
    this.el     = el;
    this.data   = data;
    this.player = null;
    this.ready  = false;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile    = window.innerWidth < 768;
    const slowConn    = navigator.connection &&
      ['slow-2g', '2g'].includes(navigator.connection.effectiveType);

    if (prefersReducedMotion || isMobile || slowConn) {
      this.renderPosterOnly();
      return;
    }

    this.renderPoster();
    this.loadAPI();
  }

  // ── Poster ──────────────────────────────────────────────────────────

  renderPoster() {
    if (!this.data.poster) return;
    const poster = document.createElement('div');
    poster.className = 'media-bg media-image yt-poster';
    poster.style.backgroundImage = `url('${this.data.poster}')`;
    poster.setAttribute('aria-hidden', 'true');
    this.el.insertBefore(poster, this.el.firstChild);
    this.posterEl = poster;
  }

  renderPosterOnly() { this.renderPoster(); }

  // ── API Loader (singleton) ───────────────────────────────────────────

  loadAPI() {
    if (window._ytAPILoaded) {
      if (window.YT && window.YT.Player) {
        this.createPlayer();
      } else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); this.createPlayer(); };
      }
      return;
    }

    window._ytAPILoaded = true;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      document.querySelectorAll('[data-yt-pending]').forEach(el => {
        el.removeAttribute('data-yt-pending');
        el._ytPlayerInstance && el._ytPlayerInstance.createPlayer();
      });
      this.createPlayer();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => console.warn('[YouTubeHeroPlayer] IFrame API blocked — showing poster.');
    document.head.appendChild(script);
  }

  // ── Player ───────────────────────────────────────────────────────────

  createPlayer() {
    const container = document.createElement('div');
    container.className = 'yt-iframe-container media-bg';
    container.setAttribute('aria-hidden', 'true');

    const playerDiv = document.createElement('div');
    playerDiv.id = 'yt-' + Math.random().toString(36).slice(2, 7);
    container.appendChild(playerDiv);
    this.el.insertBefore(container, this.el.firstChild);

    const vars = {
      autoplay: 1, mute: 1, controls: 0, disablekb: 1,
      fs: 0, iv_load_policy: 3, loop: 1, modestbranding: 1,
      playsinline: 1, rel: 0, showinfo: 0,
      playlist: this.data.youtubeId,
    };

    if (this.data.startSeconds > 0) vars.start = this.data.startSeconds;

    if (this.data.isLive) {
      delete vars.loop;
      delete vars.playlist;
    }

    this.player = new YT.Player(playerDiv.id, {
      videoId: this.data.youtubeId,
      playerVars: vars,
      events: {
        onReady:       e => this.onReady(e),
        onStateChange: e => this.onStateChange(e),
        onError:       e => this.onError(e),
      }
    });
  }

  // ── Events ───────────────────────────────────────────────────────────

  onReady(event) {
    this.ready = true;
    event.target.mute();
    event.target.playVideo();
    setTimeout(() => {
      if (this.posterEl) {
        this.posterEl.style.transition = 'opacity 1.2s ease';
        this.posterEl.style.opacity = '0';
        setTimeout(() => { if (this.posterEl) this.posterEl.style.pointerEvents = 'none'; }, 1200);
      }
    }, 800);
  }

  onStateChange(event) {
    if (event.data === 0 && !this.data.isLive) {
      this.player.seekTo(this.data.startSeconds || 0);
      this.player.playVideo();
    }
    if (event.data === 1) this.player.mute();
  }

  onError(event) {
    console.warn('[YouTubeHeroPlayer] Error', event.data, '— showing poster.');
    const container = this.el.querySelector('.yt-iframe-container');
    if (container) container.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MediaRenderer();
});
