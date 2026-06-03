/**
 * BLOG PUBLIC — Commissioned City Church
 * Handles two contexts:
 *   1. blog.html — fetches published posts and renders dynamic cards
 *   2. blog/post.html — reads ?slug= and renders the full post
 */
(function () {
  'use strict';

  var SB_URL = window.SUPABASE_URL || 'https://lkmphayrithxkmhvfiep.supabase.co';
  var SB_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_GO6ATIZLQftqjoBHTU8EKQ_5RR1397W';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── Supabase REST fetch ─────────────────────────────────── */
  async function sbFetch(path) {
    var res = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY
      }
    });
    if (!res.ok) return null;
    return res.json();
  }

  /* ── CONTEXT: blog.html ──────────────────────────────────── */
  async function initBlogIndex() {
    var grid = document.getElementById('dynamic-posts-grid');
    if (!grid) return;

    var now = new Date().toISOString();
    var data = await sbFetch(
      'blog_posts?select=*&or=(status.eq.published,and(status.eq.scheduled,publish_at.lte.' + encodeURIComponent(now) + '))&order=publish_at.desc'
    );
    if (!data || !data.length) return;

    var html = '';
    data.forEach(function (post, i) {
      var href = 'blog/post.html?slug=' + encodeURIComponent(post.slug);
      var delay = ['', ' delay-1', ' delay-2', ' delay-3'][i % 4];
      var imgHtml = post.hero_image_url
        ? '<img src="' + esc(post.hero_image_url) + '" alt="' + esc(post.title) + '" style="width:100%; height:220px; object-fit:cover; display:block; transition:transform 0.3s;" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'scale(1)\'">'
        : '<div style="width:100%; height:220px; background:var(--gray-bg); display:flex; align-items:center; justify-content:center;"><span style="color:var(--muted-blue); font-size:0.85rem;">No image</span></div>';

      var dateLabel = fmtDate(post.publish_at || post.created_at);

      html += '<article class="card fade-in-up' + delay + '" style="overflow:hidden; display:flex; flex-direction:column;">';
      html += '<a href="' + esc(href) + '" style="display:block; flex-shrink:0;">' + imgHtml + '</a>';
      html += '<div style="padding:var(--space-lg); display:flex; flex-direction:column; flex:1;">';
      if (post.category) html += '<span class="eyebrow" style="margin-bottom:8px; font-size:11px;">' + esc(post.category) + '</span>';
      html += '<h2 style="font-size:22px; font-family:\'Montserrat\',sans-serif; font-weight:700; line-height:1.3; margin-bottom:8px;">';
      html += '<a href="' + esc(href) + '" style="color:var(--navy); border-bottom:none;">' + esc(post.title) + '</a></h2>';
      html += '<p style="font-size:13px; color:var(--muted-blue); font-weight:600; margin-bottom:var(--space-md);">' + esc(post.author_name) + (dateLabel ? ' &nbsp;·&nbsp; ' + esc(dateLabel) : '') + '</p>';
      if (post.excerpt) html += '<p style="color:var(--muted-blue); margin-bottom:var(--space-lg); flex:1;">' + esc(post.excerpt) + '</p>';
      html += '<a href="' + esc(href) + '" class="btn btn-outline" style="align-self:flex-start;">Read More →</a>';
      html += '</div></article>';
    });

    grid.innerHTML = html;

    /* trigger fade-in observer if main.js already set it up */
    if (window._mpObserver) {
      grid.querySelectorAll('.fade-in-up').forEach(function (el) {
        window._mpObserver.observe(el);
      });
    } else {
      /* wait for main.js observer then re-observe */
      setTimeout(function () {
        if (window._mpObserver) {
          grid.querySelectorAll('.fade-in-up').forEach(function (el) {
            window._mpObserver.observe(el);
          });
        }
      }, 300);
    }
  }

  /* ── CONTEXT: blog/post.html ─────────────────────────────── */
  async function initPostPage() {
    var main = document.getElementById('post-main');
    if (!main) return;

    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    var preview = params.get('preview') === '1';

    if (!slug) {
      renderError(main, 'No post specified.');
      return;
    }

    /* fetch post — for preview mode, try with auth cookie (same origin) */
    var data;
    if (preview) {
      data = await sbFetchWithAuth('blog_posts?select=*&slug=eq.' + encodeURIComponent(slug) + '&limit=1');
    } else {
      var now = new Date().toISOString();
      data = await sbFetch(
        'blog_posts?select=*&slug=eq.' + encodeURIComponent(slug) +
        '&or=(status.eq.published,and(status.eq.scheduled,publish_at.lte.' + encodeURIComponent(now) + '))&limit=1'
      );
    }

    if (!data || !data.length) {
      renderError(main, 'Post not found.');
      return;
    }

    var post = data[0];

    /* update page title */
    document.title = post.title + ' — Commissioned City Church';

    var dateLabel = fmtDate(post.publish_at || post.created_at);

    var heroStyle = post.hero_image_url
      ? 'background-image: url(\'' + post.hero_image_url.replace(/'/g, "\\'") + '\'); background-size: cover; background-position: center;'
      : '';

    var html = '';

    /* preview banner */
    if (preview) {
      html += '<div style="background:#112E53; color:#fff; text-align:center; padding:10px 20px; font-size:0.85rem; font-weight:600; letter-spacing:0.03em;">PREVIEW — This post is not yet published</div>';
    }

    /* hero */
    html += '<section class="page-hero page-hero--navy page-hero--left" style="min-height:52vh; ' + heroStyle + '" aria-labelledby="post-heading">';
    html += '<nav style="position:absolute; top:calc(var(--navbar-h,72px) + var(--space-md)); left:var(--space-lg); font-size:13px; color:rgba(255,255,255,0.6);" aria-label="Breadcrumb">';
    html += '<a href="../blog.html" style="color:rgba(255,255,255,0.6); text-decoration:none;">Blog</a>';
    if (post.category) {
      html += '<span aria-hidden="true" style="margin:0 6px;">›</span><span>' + esc(post.category) + '</span>';
    }
    html += '</nav>';
    if (post.category) html += '<span class="eyebrow fade-in-up" style="color:rgba(255,255,255,0.7);">' + esc(post.category) + '</span>';
    html += '<h1 id="post-heading" class="fade-in-up delay-1" style="color:white; max-width:700px;">' + esc(post.title) + '</h1>';
    html += '<p class="fade-in-up delay-2" style="color:rgba(255,255,255,0.8); max-width:560px; font-size:16px; margin-top:var(--space-sm);">';
    html += esc(post.author_name);
    if (dateLabel) html += ' &nbsp;·&nbsp; ' + esc(dateLabel);
    html += '</p></section>';

    /* article body */
    html += '<section class="section"><div class="container text-block mx-auto">';
    html += '<a href="../blog.html" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--muted-blue); margin-bottom:var(--space-lg); border-bottom:none;">← Back to Blog</a>';
    html += post.content || '<p class="fade-in-up">No content yet.</p>';
    html += '<div class="fade-in-up" style="display:flex; gap:var(--space-md); margin-top:var(--space-xl); flex-wrap:wrap;">';
    html += '<a href="../blog.html" class="btn btn-outline">← Back to Blog</a>';
    html += '</div></div></section>';

    main.innerHTML = html;

    /* re-trigger fade-in animations */
    setTimeout(function () {
      main.querySelectorAll('.fade-in-up').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }, 100);
  }

  function renderError(main, msg) {
    main.innerHTML = '<section class="section"><div class="container text-block mx-auto" style="padding-top:80px;">'
      + '<h2 style="color:var(--navy);">Post not found</h2>'
      + '<p style="color:var(--muted-blue);">' + esc(msg) + '</p>'
      + '<a href="../blog.html" class="btn btn-outline" style="margin-top:24px;">← Back to Blog</a>'
      + '</div></section>';
  }

  /* fetch with session token for admin preview */
  async function sbFetchWithAuth(path) {
    /* try to get token from Supabase JS SDK if loaded */
    var token = SB_KEY;
    try {
      if (window.supabase) {
        var sb = window.supabase.createClient(SB_URL, SB_KEY);
        var { data: { session } } = await sb.auth.getSession();
        if (session && session.access_token) token = session.access_token;
      }
    } catch (e) { /* ignore */ }

    var res = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return null;
    return res.json();
  }

  /* ── Boot ────────────────────────────────────────────────── */
  function boot() {
    var path = window.location.pathname;
    if (document.getElementById('dynamic-posts-grid')) {
      initBlogIndex();
    } else if (document.getElementById('post-main')) {
      initPostPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
