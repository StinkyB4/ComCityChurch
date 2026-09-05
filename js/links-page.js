/**
 * LINK PAGE — public hydration (/links)
 *
 * Applies whatever an admin saved in /members/admin → "Link Page" over the
 * defaults written into links.html.
 *
 * The contract with links.html, in one line: the HTML is the fallback, the
 * database is the source of truth once it has rows. If anything here fails —
 * offline, Supabase down, tables never created — the page keeps the markup it
 * shipped with. Nothing in this file is allowed to blank the page or throw.
 */
(function () {
  'use strict';

  var SB_URL = window.SUPABASE_URL;
  var SB_KEY = window.SUPABASE_ANON_KEY;
  var CACHE_KEY = 'ccc-linkpage-theme';

  if (!SB_URL || !SB_KEY) return;

  /* ── helpers ─────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Only allow hrefs we are willing to put in the DOM. Blocks javascript:
     and data: URLs, which would otherwise be a stored-XSS route for anyone
     who got write access to the links table. */
  function safeHref(url) {
    var u = String(url == null ? '' : url).trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (u.charAt(0) === '/' || u.charAt(0) === '#') return u;   /* same-site */
    return '';
  }

  function sbFetch(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ── theme ───────────────────────────────────────────────── */

  /* Maps a settings row onto the --lp-* custom properties and the three
     body switches. Same names the file documents in sections 1 and 3, so
     what an admin picks and what a hand-editor types stay interchangeable. */
  function themeFrom(s) {
    var vars = {
      '--lp-bg':        s.bg_color,
      '--lp-bg-image':  s.bg_type === 'image' && s.bg_image_url
                          ? 'url("' + String(s.bg_image_url).replace(/["\\]/g, '') + '")'
                          : 'none',
      '--lp-overlay':   String(s.bg_overlay),
      '--lp-btn':       s.btn_color,
      '--lp-btn-text':  s.btn_text_color,
      '--lp-font':      s.font_color,
      '--lp-radius':    (parseInt(s.btn_radius, 10) || 0) + 'px',
      '--lp-logo':      (parseInt(s.logo_size, 10) || 180) + 'px'
    };
    var attrs = {
      'data-bg':    s.bg_type === 'image' ? 'image' : 'color',
      'data-btn':   s.btn_style === 'outline' ? 'outline' : 'solid',
      'data-plate': s.logo_plate ? 'on' : 'off'
    };
    return { vars: vars, attrs: attrs };
  }

  function applyTheme(t) {
    var root = document.documentElement.style;
    for (var k in t.vars) if (t.vars[k]) root.setProperty(k, t.vars[k]);
    for (var a in t.attrs) document.body.setAttribute(a, t.attrs[a]);
  }

  function applyHeader(s) {
    var logo = document.querySelector('.lp-logo-plate img');
    var head = document.querySelector('.lp-headline');
    var sub  = document.querySelector('.lp-sub');
    var foot = document.querySelector('.lp-footer');
    if (logo && s.logo_url) { logo.src = s.logo_url; }
    if (head && s.headline != null) head.textContent = s.headline;
    if (sub  && s.tagline  != null) sub.textContent  = s.tagline;
    if (foot && s.footer_text != null) foot.textContent = s.footer_text;
  }

  /* ── link buttons ────────────────────────────────────────── */

  function buttonHtml(l) {
    var href = safeHref(l.url);
    if (!href) return '';
    var icon = /^icon-[a-z-]+$/.test(l.icon || '') ? l.icon : '';
    var ext  = l.new_tab ? ' target="_blank" rel="noopener"' : '';
    var arrow = l.new_tab ? 'icon-arrow-out' : 'icon-chevron';

    return '<a class="lp-btn" href="' + esc(href) + '"' + ext + '>'
      + (icon ? '<span class="lp-btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#' + icon + '"></use></svg></span>' : '')
      + '<span class="lp-btn-text">'
      +   '<span class="lp-btn-label">' + esc(l.label) + '</span>'
      +   '<span class="lp-btn-sub">' + esc(l.sublabel || '') + '</span>'
      + '</span>'
      + '<span class="lp-btn-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#' + arrow + '"></use></svg></span>'
      + '</a>';
  }

  function socialHtml(l) {
    var href = safeHref(l.url);
    if (!href) return '';
    var name = /^[a-z]+$/.test(l.icon || '') ? l.icon : 'mail';
    var ext  = /^(https?:)/i.test(href) ? ' target="_blank" rel="noopener"' : '';
    /* An icon-only link is meaningless to a screen reader without a label. */
    var label = esc(l.label || name);
    return '<a class="lp-social" href="' + esc(href) + '"' + ext + ' aria-label="' + label + '">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-social-' + name + '"></use></svg>'
      + '</a>';
  }

  function render(links) {
    var buttons = [], socials = [];
    links.forEach(function (l) {
      var html = l.kind === 'social' ? socialHtml(l) : buttonHtml(l);
      if (!html) return;
      (l.kind === 'social' ? socials : buttons).push(html);
    });
    /* Replace a list only when there is something to replace it with, so a
       misconfigured table cannot leave the page with no links at all. */
    var nav = document.querySelector('.lp-links');
    if (nav && buttons.length) nav.innerHTML = buttons.join('');
    var soc = document.querySelector('.lp-socials');
    if (soc && socials.length) soc.innerHTML = socials.join('');
  }

  /* ── go ──────────────────────────────────────────────────── */

  function hydrate() {
    sbFetch('link_page_settings?select=*&id=eq.1').then(function (rows) {
      if (!rows || !rows.length) return;
      var s = rows[0];
      var t = themeFrom(s);
      applyTheme(t);
      applyHeader(s);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(t)); } catch (e) { /* storage blocked */ }
    });

    sbFetch('link_page_links?select=*&is_visible=is.true&order=kind.desc,sort_order.asc')
      .then(function (rows) { if (rows && rows.length) render(rows); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
