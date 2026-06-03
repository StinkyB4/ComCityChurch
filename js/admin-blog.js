/**
 * ADMIN — Blog Management Tab
 * Adds a "Blog" tab to admin.html.
 * Admins can: review pending posts, approve, schedule, reject, delete all posts.
 */
(function () {
  'use strict';

  /* ── Inject editor CSS once ──────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('blog-editor-css')) return;
    var link = document.createElement('link');
    link.id = 'blog-editor-css';
    link.rel = 'stylesheet';
    link.href = '/css/editor.css';
    document.head.appendChild(link);
  }

  /* ── Tiny esc helper ─────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function showToast(msg) {
    var t = document.getElementById('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('admin-toast--visible');
    setTimeout(function () { t.classList.remove('admin-toast--visible'); }, 3800);
  }

  /* ── Supabase client ─────────────────────────────────────── */
  function getSb() {
    if (window._adminBlogSb) return window._adminBlogSb;
    if (!window.supabase) return null;
    window._adminBlogSb = window.supabase.createClient(
      window.SUPABASE_URL, window.SUPABASE_ANON_KEY
    );
    return window._adminBlogSb;
  }

  /* ── Render blog admin panel ─────────────────────────────── */
  async function renderBlogAdmin(subTab) {
    subTab = subTab || 'pending';
    var panel = document.getElementById('tab-blog');
    if (!panel) return;

    injectCSS();

    var sb = getSb();
    if (!sb) { panel.innerHTML = '<p style="color:red;">Supabase not ready.</p>'; return; }

    /* sub-nav */
    var html = '<div class="section-header" style="margin-bottom:1.5rem; align-items:flex-start; flex-direction:column; gap:12px;">';
    html += '<h2>Blog Posts</h2>';
    html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
    html += '<button class="mp-btn mp-btn--small' + (subTab === 'pending' ? ' mp-btn--primary' : ' mp-btn--outline') + '" onclick="adminBlog.show(\'pending\')">Pending Review</button>';
    html += '<button class="mp-btn mp-btn--small' + (subTab === 'all' ? ' mp-btn--primary' : ' mp-btn--outline') + '" onclick="adminBlog.show(\'all\')">All Posts</button>';
    html += '</div></div>';

    if (subTab === 'pending') {
      var { data: posts, error } = await sb.from('blog_posts')
        .select('*').eq('status', 'pending').order('updated_at', { ascending: false });

      if (error) { panel.innerHTML = html + '<p style="color:red;">Error: ' + esc(error.message) + '</p>'; return; }

      if (!posts || !posts.length) {
        panel.innerHTML = html + '<p class="loading" style="color:#5C718E;">No posts awaiting review.</p>';
        return;
      }

      html += '<div style="display:flex; flex-direction:column; gap:16px;">';
      posts.forEach(function (p) {
        html += '<div style="background:#fff; border:1.5px solid #dde3eb; border-radius:8px; overflow:hidden;">';

        /* header */
        html += '<div style="background:#f4f5f7; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">';
        html += '<div>';
        html += '<div style="font-weight:700; font-size:0.95rem; color:#112E53;">' + esc(p.title) + '</div>';
        html += '<div style="font-size:0.8rem; color:#5C718E; margin-top:2px;">By ' + esc(p.author_name) + ' &nbsp;·&nbsp; Submitted ' + esc(fmtDate(p.updated_at)) + '</div>';
        html += '</div>';
        html += '<a href="/blog/post.html?slug=' + encodeURIComponent(p.slug) + '&preview=1" target="_blank" class="mp-btn mp-btn--small" style="background:#e5ecf8; color:#112E53; text-decoration:none;">Preview →</a>';
        html += '</div>';

        /* excerpt */
        if (p.excerpt) {
          html += '<div style="padding:12px 16px; font-size:0.88rem; color:#5C718E; border-bottom:1px solid #f0f4f8; font-style:italic;">' + esc(p.excerpt) + '</div>';
        }

        /* actions */
        html += '<div style="padding:12px 16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">';
        html += '<button class="mp-btn mp-btn--small mp-btn--approve" onclick="adminBlog.approve(\'' + esc(p.id) + '\')">✓ Approve &amp; Publish</button>';
        html += '<button class="mp-btn mp-btn--small" style="background:#e8eaf6; color:#3949ab;" onclick="adminBlog.scheduleModal(\'' + esc(p.id) + '\',\'' + esc(p.title) + '\')">Schedule</button>';
        html += '<button class="mp-btn mp-btn--small mp-btn--danger" onclick="adminBlog.reject(\'' + esc(p.id) + '\',\'' + esc(p.title) + '\')">Reject</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';

    } else {
      /* all posts */
      var { data: all, error: errAll } = await sb.from('blog_posts')
        .select('id,title,slug,status,author_name,publish_at,updated_at')
        .order('updated_at', { ascending: false });

      if (errAll) { panel.innerHTML = html + '<p style="color:red;">Error: ' + esc(errAll.message) + '</p>'; return; }

      if (!all || !all.length) {
        panel.innerHTML = html + '<p class="loading" style="color:#5C718E;">No posts found.</p>';
        return;
      }

      html += '<div style="background:#fff; border:1.5px solid #dde3eb; border-radius:8px; overflow:hidden;">';
      html += '<table class="blog-posts-table"><thead><tr>';
      html += '<th>Title</th><th>Author</th><th>Status</th><th>Date</th><th style="text-align:right;">Actions</th>';
      html += '</tr></thead><tbody>';

      all.forEach(function (p) {
        html += '<tr>';
        html += '<td style="font-weight:600; color:#112E53;">' + esc(p.title || '(untitled)') + '</td>';
        html += '<td style="font-size:0.83rem; color:#5C718E;">' + esc(p.author_name) + '</td>';
        html += '<td><span class="blog-status blog-status--' + esc(p.status) + '">' + esc(p.status) + '</span></td>';
        html += '<td style="font-size:0.83rem; color:#5C718E;">' + esc(fmtDate(p.publish_at || p.updated_at)) + '</td>';
        html += '<td style="text-align:right;">';
        html += '<a href="/blog/post.html?slug=' + encodeURIComponent(p.slug) + '&preview=1" target="_blank" class="mp-btn mp-btn--small" style="background:#e5ecf8; color:#112E53; text-decoration:none;">Preview</a> ';
        if (p.status === 'published' || p.status === 'scheduled') {
          html += '<button class="mp-btn mp-btn--small" style="background:#fff3e0; color:#e65100;" onclick="adminBlog.unpublish(\'' + esc(p.id) + '\')">Unpublish</button> ';
        }
        if (p.status === 'pending') {
          html += '<button class="mp-btn mp-btn--small mp-btn--approve" onclick="adminBlog.approve(\'' + esc(p.id) + '\')">Approve</button> ';
        }
        html += '<button class="mp-btn mp-btn--small mp-btn--danger" onclick="adminBlog.deletePost(\'' + esc(p.id) + '\',\'' + esc(p.title) + '\')">Delete</button>';
        html += '</td></tr>';
      });

      html += '</tbody></table></div>';
    }

    panel.innerHTML = html;
  }

  /* ── Schedule modal (inline) ─────────────────────────────── */
  function scheduleModal(id, title) {
    var date = prompt('Schedule publish date for "' + title + '" (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    var time = prompt('Time (HH:MM, 24-hour, local):', '09:00');
    if (!time) return;
    var dt = new Date(date + 'T' + time + ':00');
    if (isNaN(dt.getTime())) { alert('Invalid date/time.'); return; }
    schedulePost(id, dt.toISOString());
  }

  async function schedulePost(id, isoDate) {
    var sb = getSb();
    var { error } = await sb.from('blog_posts').update({
      status: 'scheduled',
      publish_at: isoDate,
      admin_note: null
    }).eq('id', id);
    if (error) { alert('Schedule failed: ' + error.message); return; }
    showToast('Post scheduled.');
    renderBlogAdmin('pending');
  }

  async function approve(id) {
    var sb = getSb();
    var { error } = await sb.from('blog_posts').update({
      status: 'published',
      publish_at: new Date().toISOString(),
      admin_note: null
    }).eq('id', id);
    if (error) { alert('Approve failed: ' + error.message); return; }
    showToast('Post published.');
    renderBlogAdmin('pending');
  }

  async function reject(id, title) {
    var note = prompt('Rejection note for "' + title + '" (optional, shown to author):');
    if (note === null) return; /* cancelled */
    var sb = getSb();
    var { error } = await sb.from('blog_posts').update({
      status: 'draft',
      admin_note: note || null
    }).eq('id', id);
    if (error) { alert('Reject failed: ' + error.message); return; }
    showToast('Post returned to author.');
    renderBlogAdmin('pending');
  }

  async function unpublish(id) {
    if (!confirm('Unpublish this post? It will revert to draft.')) return;
    var sb = getSb();
    var { error } = await sb.from('blog_posts').update({ status: 'draft', publish_at: null }).eq('id', id);
    if (error) { alert('Failed: ' + error.message); return; }
    showToast('Post unpublished.');
    renderBlogAdmin('all');
  }

  async function deletePost(id, title) {
    if (!confirm('Permanently delete "' + title + '"?')) return;
    var sb = getSb();
    var { error } = await sb.from('blog_posts').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    showToast('Post deleted.');
    renderBlogAdmin('all');
  }

  /* ── Global API ──────────────────────────────────────────── */
  window.adminBlog = {
    show:          function (tab) { renderBlogAdmin(tab); },
    approve:       approve,
    scheduleModal: scheduleModal,
    reject:        reject,
    unpublish:     unpublish,
    deletePost:    deletePost
  };

  /* ── Hook into admin.html switchTab ──────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    /* wrap existing switchTab to intercept 'blog' */
    var origSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
      if (tab === 'blog') {
        /* hide other panels, show blog panel */
        document.querySelectorAll('.admin-tab-panel').forEach(function (el) {
          el.style.display = 'none';
        });
        var blogPanel = document.getElementById('tab-blog');
        if (blogPanel) { blogPanel.style.display = ''; }

        /* update sub-nav active */
        document.querySelectorAll('#admin-sub-nav a[data-tab]').forEach(function (a) {
          a.classList.toggle('active', a.dataset.tab === 'blog');
        });

        renderBlogAdmin('pending');
        return;
      }
      if (typeof origSwitchTab === 'function') origSwitchTab(tab);
    };
  });

})();
