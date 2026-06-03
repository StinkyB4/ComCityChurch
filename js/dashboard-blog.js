/**
 * DASHBOARD — Blog Tab
 * Registers render_blog on window.mpDashboard.
 * Leaders and admins can create/edit posts and submit for review.
 *
 * Supabase table required: blog_posts
 * See supabase-blog-setup.sql for schema and RLS policies.
 */
(function () {
  'use strict';

  /* ── Wait for mpDashboard to initialise ─────────────────── */
  function whenReady(fn) {
    if (window.mpDashboard && typeof window.mpDashboard.getSb === 'function') {
      fn();
    } else {
      setTimeout(function () { whenReady(fn); }, 60);
    }
  }

  /* ── Inject editor CSS once ──────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('blog-editor-css')) return;
    var link = document.createElement('link');
    link.id = 'blog-editor-css';
    link.rel = 'stylesheet';
    link.href = '/css/editor.css';
    document.head.appendChild(link);
  }

  whenReady(function () {
    injectCSS();

    var D = window.mpDashboard;

    /* ── Helpers ─────────────────────────────────────────── */
    function sb() { return D.getSb(); }
    function esc(s) { return D.esc(s); }
    function fmtDate(d) { return D.fmtDate(d); }
    function setContent(html) { D.setContent(html); }
    function showToast(msg) { window.showToast && window.showToast(msg); }

    function fmtPubDate(post) {
      var d = post.publish_at || post.updated_at || post.created_at;
      return d ? fmtDate(d) : '';
    }

    function slugify(s) {
      return s.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    /* ── state ─────────────────────────────────────────────── */
    var _editingId = null;   /* null = new post */
    var _editorFrame = null; /* the iframe el */
    var _heroBlob = null;    /* staged hero image blob */
    var _heroFileName = null;
    var _slugLocked = false; /* lock slug after first publish */

    /* ── Post list ─────────────────────────────────────────── */
    async function renderBlogList() {
      var user = D.getUser();
      var isAdmin = D.isAdmin();

      var query = isAdmin
        ? sb().from('blog_posts').select('id,title,slug,status,publish_at,updated_at,author_name').order('updated_at', { ascending: false })
        : sb().from('blog_posts').select('id,title,slug,status,publish_at,updated_at,author_name').eq('author_id', user.id).order('updated_at', { ascending: false });

      var { data: posts, error } = await query;
      if (error) { setContent('<p class="mp-empty">Error loading posts: ' + esc(error.message) + '</p>'); return; }

      var html = '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px;">';
      html += '<h2 class="mp-tab-title" style="margin:0;">Blog Posts</h2>';
      html += '<button class="mp-btn mp-btn--primary" onclick="mpBlog.openEditor(null)">+ New Post</button>';
      html += '</div>';

      if (!posts || !posts.length) {
        html += '<p class="mp-empty">No posts yet. Click <strong>+ New Post</strong> to get started.</p>';
        setContent(html);
        return;
      }

      html += '<div style="background:#fff; border:1.5px solid #dde3eb; border-radius:8px; overflow:hidden;">';
      html += '<table class="blog-posts-table"><thead><tr>';
      html += '<th>Title</th><th>Status</th><th>Date</th>';
      if (isAdmin) html += '<th>Author</th>';
      html += '<th style="text-align:right;">Actions</th>';
      html += '</tr></thead><tbody>';

      posts.forEach(function (p) {
        var statusClass = 'blog-status--' + p.status;
        html += '<tr>';
        html += '<td style="font-weight:600; color:#112E53;">' + esc(p.title || '(untitled)') + '</td>';
        html += '<td><span class="blog-status ' + statusClass + '">' + esc(p.status) + '</span></td>';
        html += '<td style="color:#5C718E; font-size:0.83rem;">' + esc(fmtPubDate(p)) + '</td>';
        if (isAdmin) html += '<td style="font-size:0.83rem; color:#5C718E;">' + esc(p.author_name) + '</td>';
        html += '<td style="text-align:right;">';
        html += '<button class="mp-btn mp-btn--small mp-btn--outline" onclick="mpBlog.openEditor(\'' + esc(p.id) + '\')">Edit</button> ';
        html += '<a href="/blog/post.html?slug=' + encodeURIComponent(p.slug) + '&preview=1" target="_blank" class="mp-btn mp-btn--small" style="background:#f0f4f8; color:#112E53; text-decoration:none;">Preview</a> ';
        html += '<button class="mp-btn mp-btn--small blog-tb-btn--danger" onclick="mpBlog.deletePost(\'' + esc(p.id) + '\',\'' + esc(p.title) + '\')">Delete</button>';
        html += '</td></tr>';
      });

      html += '</tbody></table></div>';
      setContent(html);
    }

    /* ── Editor ────────────────────────────────────────────── */
    async function renderEditor(postId) {
      _editingId = postId || null;
      _heroBlob = null;
      _heroFileName = null;

      var post = null;
      if (_editingId) {
        var { data } = await sb().from('blog_posts').select('*').eq('id', _editingId).single();
        post = data;
      }

      _slugLocked = post && (post.status === 'published' || post.status === 'scheduled');

      var title = post ? post.title : '';
      var slug = post ? post.slug : '';
      var category = post ? post.category : '';
      var excerpt = post ? post.excerpt : '';
      var heroUrl = post ? (post.hero_image_url || '') : '';
      var status = post ? post.status : 'draft';
      var adminNote = post ? post.admin_note : '';

      var html = '';

      /* header */
      html += '<div class="blog-editor-header">';
      html += '<button class="mp-btn mp-btn--outline mp-btn--small" onclick="mpBlog.backToList()">← All Posts</button>';
      html += '<h3>' + (post ? 'Edit Post' : 'New Post') + '</h3>';
      html += '<span class="blog-status blog-status--' + esc(status) + '">' + esc(status) + '</span>';
      html += '</div>';

      if (adminNote && status === 'draft') {
        html += '<div class="blog-admin-note"><strong>Returned by admin:</strong>' + esc(adminNote) + '</div>';
      }

      html += '<div class="blog-editor-wrap">';

      /* ── Left: toolbar + iframe canvas ── */
      html += '<div class="blog-editor-left">';
      html += '<div class="blog-toolbar" id="blog-toolbar">';

      /* Block formats */
      html += '<button class="blog-tb-btn" title="Section heading" onclick="mpBlog.applyBlock(\'h2\',\'fade-in-up\')">H2</button>';
      html += '<button class="blog-tb-btn" title="Sub-heading" onclick="mpBlog.applyBlock(\'h3\',\'fade-in-up\')">H3</button>';
      html += '<button class="blog-tb-btn" title="Body paragraph" onclick="mpBlog.applyBlock(\'p\',\'fade-in-up\')">Body</button>';
      html += '<div class="blog-toolbar-sep"></div>';

      /* Text styles */
      html += '<button class="blog-tb-btn" title="Eyebrow label" onclick="mpBlog.insertInline(\'eyebrow\')">Eyebrow</button>';
      html += '<button class="blog-tb-btn" title="Pull quote" onclick="mpBlog.applyBlock(\'p\',\'pull-quote fade-in-up\')">Pull Quote</button>';
      html += '<button class="blog-tb-btn" title="Scripture passage" onclick="mpBlog.applyBlock(\'p\',\'scripture fade-in-up\')">Scripture</button>';
      html += '<div class="blog-toolbar-sep"></div>';

      /* Inline */
      html += '<button class="blog-tb-btn" title="Bold" onclick="mpBlog.execCmd(\'bold\')"><strong>B</strong></button>';
      html += '<button class="blog-tb-btn" title="Italic" onclick="mpBlog.execCmd(\'italic\')"><em>I</em></button>';
      html += '<div class="blog-toolbar-sep"></div>';

      /* Insert */
      html += '<button class="blog-tb-btn" title="Styled blockquote" onclick="mpBlog.insertBlockquote()">Blockquote</button>';
      html += '<button class="blog-tb-btn" title="Unordered list" onclick="mpBlog.execCmd(\'insertUnorderedList\')">List</button>';
      html += '<button class="blog-tb-btn" title="Insert a link button" onclick="mpBlog.insertButton()">Button</button>';
      html += '<button class="blog-tb-btn" title="Insert inline image" onclick="mpBlog.insertImage()">Image</button>';

      html += '</div>'; /* end toolbar */

      /* iframe canvas */
      html += '<iframe id="blog-editor-frame" class="blog-canvas-frame" title="Post content editor"></iframe>';
      html += '</div>'; /* end left */

      /* ── Right: metadata ── */
      html += '<div class="blog-meta-panel">';

      /* Publish actions */
      html += '<div class="blog-meta-card">';
      html += '<h4>Publish</h4>';
      html += '<div class="blog-editor-actions">';
      html += '<button class="mp-btn mp-btn--secondary" onclick="mpBlog.saveDraft()">Save Draft</button>';
      if (status !== 'published' && status !== 'scheduled') {
        html += '<button class="mp-btn mp-btn--primary" onclick="mpBlog.submitForReview()">Submit for Review</button>';
      }
      html += '</div>';
      html += '</div>';

      /* Hero image */
      html += '<div class="blog-meta-card"><h4>Hero Image</h4>';
      if (heroUrl) {
        html += '<img id="blog-hero-preview" src="' + esc(heroUrl) + '" class="blog-hero-preview" alt="Hero image">';
      } else {
        html += '<div class="blog-hero-placeholder" id="blog-hero-placeholder">No image selected</div>';
        html += '<img id="blog-hero-preview" src="" class="blog-hero-preview" alt="Hero image" style="display:none;">';
      }
      html += '<label class="mp-btn mp-btn--secondary mp-btn--small" for="blog-hero-file" style="cursor:pointer; display:block; text-align:center; margin-top:4px;">Choose Image</label>';
      html += '<input type="file" id="blog-hero-file" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="mpBlog.onHeroFile(this)">';
      html += '<span class="mp-hint" style="margin-top:4px; display:block;">JPG/PNG/WebP. Recommended: 1400×700px.</span>';
      html += '</div>';

      /* Post details */
      html += '<div class="blog-meta-card"><h4>Details</h4>';
      html += '<div class="mp-form-group"><label style="font-size:0.8rem;">Title <span class="mp-required">*</span></label>';
      html += '<input type="text" id="blog-title" value="' + esc(title) + '" placeholder="Post title" oninput="mpBlog.onTitleInput(this.value)"></div>';

      html += '<div class="mp-form-group"><label style="font-size:0.8rem;">Slug';
      if (_slugLocked) html += ' <span class="blog-slug-locked" title="Locked after publishing">🔒</span>';
      html += '</label>';
      html += '<input type="text" id="blog-slug" value="' + esc(slug) + '" placeholder="url-friendly-slug"' + (_slugLocked ? ' readonly style="background:#f4f5f7; color:#5C718E;"' : '') + '></div>';

      html += '<div class="mp-form-group"><label style="font-size:0.8rem;">Category</label>';
      html += '<input type="text" id="blog-category" value="' + esc(category) + '" placeholder="e.g. Sermon Reflection"></div>';

      html += '<div class="mp-form-group"><label style="font-size:0.8rem;">Excerpt</label>';
      html += '<textarea id="blog-excerpt" rows="3" placeholder="Brief description shown on the blog index…">' + esc(excerpt) + '</textarea></div>';

      html += '</div>'; /* end details card */
      html += '</div>'; /* end meta panel */
      html += '</div>'; /* end editor wrap */

      setContent(html);

      /* init iframe editor */
      _editorFrame = document.getElementById('blog-editor-frame');
      if (_editorFrame) {
        _editorFrame.addEventListener('load', function () {
          initEditorFrame(post ? post.content : '');
        });
        /* write blank doc to trigger load */
        _editorFrame.src = 'about:blank';
      }
    }

    /* ── Init iframe with site CSS ───────────────────────────── */
    function initEditorFrame(content) {
      if (!_editorFrame) return;
      var doc = _editorFrame.contentDocument || _editorFrame.contentWindow.document;
      var cssBase = window.location.origin;
      doc.open();
      doc.write('<!DOCTYPE html><html><head>'
        + '<meta charset="UTF-8">'
        + '<link rel="preconnect" href="https://fonts.googleapis.com">'
        + '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400&family=Montserrat:wght@600;700;800&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">'
        + '<link rel="stylesheet" href="' + cssBase + '/css/styles.css">'
        + '<style>'
        + 'body { padding: 32px 40px; min-height: 480px; outline: none; font-family: "Source Sans Pro", sans-serif; font-size: 17px; line-height: 1.75; color: var(--charcoal, #30343B); max-width: 760px; margin: 0 auto; }'
        + 'body:empty::before { content: "Start writing your post here…"; color: #aaa; }'
        + '[contenteditable]:focus { outline: none; }'
        + '</style>'
        + '</head>'
        + '<body contenteditable="true">'
        + (content || '')
        + '</body></html>');
      doc.close();

      /* relay keyboard shortcut for save */
      _editorFrame.contentWindow.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          mpBlog.saveDraft();
        }
      });
    }

    /* ── Get editor HTML ─────────────────────────────────────── */
    function getEditorContent() {
      if (!_editorFrame || !_editorFrame.contentDocument) return '';
      return _editorFrame.contentDocument.body.innerHTML;
    }

    /* ── Get editor document/selection ──────────────────────── */
    function edDoc() {
      return _editorFrame && (_editorFrame.contentDocument || _editorFrame.contentWindow.document);
    }

    /* ── Apply block format ──────────────────────────────────── */
    function applyBlock(tag, classes) {
      var doc = edDoc(); if (!doc) return;
      _editorFrame.contentWindow.focus();
      var sel = doc.getSelection();
      if (!sel || !sel.rangeCount) return;

      var range = sel.getRangeAt(0);
      var node = range.commonAncestorContainer;
      while (node && node.nodeType === 3) node = node.parentNode;

      /* find nearest block ancestor inside body */
      var block = node;
      while (block && block !== doc.body) {
        var display = doc.defaultView.getComputedStyle(block).display;
        if (display === 'block' || display === 'list-item') break;
        block = block.parentNode;
      }

      var newEl = doc.createElement(tag);
      if (classes) newEl.className = classes;

      if (block && block !== doc.body) {
        newEl.innerHTML = block.innerHTML || '<br>';
        block.parentNode.replaceChild(newEl, block);
      } else {
        newEl.innerHTML = '<br>';
        range.insertNode(newEl);
      }

      /* move caret into new element */
      var r = doc.createRange();
      r.setStart(newEl, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      newEl.focus && newEl.focus();
    }

    /* ── Insert inline span ──────────────────────────────────── */
    function insertInline(cls) {
      var doc = edDoc(); if (!doc) return;
      _editorFrame.contentWindow.focus();
      var sel = doc.getSelection();
      if (!sel || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      var span = doc.createElement('span');
      span.className = cls;
      var selected = range.extractContents();
      span.appendChild(selected.childNodes.length ? selected : doc.createTextNode('Label'));
      range.insertNode(span);
      range.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    /* ── Insert blockquote ──────────────────────────────────── */
    function insertBlockquote() {
      var doc = edDoc(); if (!doc) return;
      _editorFrame.contentWindow.focus();
      var sel = doc.getSelection();
      var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

      var div = doc.createElement('div');
      div.className = 'fade-in-up';
      div.style.cssText = 'border-left:4px solid var(--red,#D5393B); padding:var(--space-md,24px) var(--space-lg,48px); background:var(--gray-bg,#F4F5F7); border-radius:0 var(--radius-card,14px) var(--radius-card,14px) 0; margin:var(--space-lg,48px) 0;';
      div.innerHTML = '<p style="font-style:italic; margin:0; color:var(--charcoal,#30343B);">Quote text here.</p>'
        + '<p style="font-size:13px; font-weight:600; color:var(--muted-blue,#5C718E); margin:8px 0 0;">— Attribution</p>';

      if (range) { range.collapse(false); range.insertNode(div); }
      else { doc.body.appendChild(div); }

      /* place cursor into quote text */
      var qp = div.querySelector('p');
      if (qp) {
        var r = doc.createRange();
        r.setStart(qp, 0); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
      }
    }

    /* ── Insert button link ─────────────────────────────────── */
    function insertButton() {
      var doc = edDoc(); if (!doc) return;
      var label = prompt('Button label:', 'Read More');
      if (!label) return;
      var url = prompt('Button URL:', 'https://');
      if (!url) return;
      _editorFrame.contentWindow.focus();

      var wrap = doc.createElement('div');
      wrap.className = 'fade-in-up';
      wrap.style.cssText = 'display:flex; gap:var(--space-md,24px); margin:var(--space-lg,48px) 0; flex-wrap:wrap;';
      var a = doc.createElement('a');
      a.href = url; a.className = 'btn btn-outline-navy';
      a.target = '_blank'; a.rel = 'noopener';
      a.textContent = label;
      wrap.appendChild(a);

      var sel = doc.getSelection();
      var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range) { range.collapse(false); range.insertNode(wrap); }
      else { doc.body.appendChild(wrap); }
    }

    /* ── Insert inline image by URL ─────────────────────────── */
    function insertImage() {
      var url = prompt('Paste image URL:', 'https://');
      if (!url || url === 'https://') return;
      var doc = edDoc(); if (!doc) return;
      _editorFrame.contentWindow.focus();
      var img = doc.createElement('img');
      img.src = url; img.alt = '';
      img.style.cssText = 'width:100%; border-radius:var(--radius-card,14px); margin:var(--space-md,24px) 0; display:block;';
      var sel = doc.getSelection();
      var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range) { range.collapse(false); range.insertNode(img); }
      else { doc.body.appendChild(img); }
    }

    /* ── Hero file chosen ─────────────────────────────────── */
    function onHeroFile(input) {
      if (!input.files || !input.files[0]) return;
      _heroBlob = input.files[0];
      _heroFileName = input.files[0].name;
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('blog-hero-preview');
        var placeholder = document.getElementById('blog-hero-placeholder');
        if (preview) { preview.src = e.target.result; preview.style.display = ''; }
        if (placeholder) placeholder.style.display = 'none';
      };
      reader.readAsDataURL(_heroBlob);
    }

    /* ── Title → auto-slug ──────────────────────────────────── */
    function onTitleInput(val) {
      if (_slugLocked) return;
      var slugEl = document.getElementById('blog-slug');
      if (slugEl) slugEl.value = slugify(val);
    }

    /* ── Collect form fields ────────────────────────────────── */
    function collectFields() {
      return {
        title: (document.getElementById('blog-title') || {}).value || '',
        slug: (document.getElementById('blog-slug') || {}).value || '',
        category: (document.getElementById('blog-category') || {}).value || '',
        excerpt: (document.getElementById('blog-excerpt') || {}).value || '',
        content: getEditorContent()
      };
    }

    /* ── Upload hero, return URL or existing ─────────────────── */
    async function resolveHeroUrl(existingUrl) {
      if (!_heroBlob) return existingUrl || null;
      var user = D.getUser();
      var ext = (_heroFileName || 'jpg').split('.').pop() || 'jpg';
      var path = user.id + '/hero-' + Date.now() + '.' + ext;
      var { error } = await sb().storage.from('blog-images').upload(path, _heroBlob, { upsert: true, contentType: _heroBlob.type });
      if (error) { alert('Hero image upload failed: ' + error.message); return existingUrl || null; }
      var { data: ud } = sb().storage.from('blog-images').getPublicUrl(path);
      return ud && ud.publicUrl;
    }

    /* ── Save draft ──────────────────────────────────────────── */
    async function saveDraft() {
      var fields = collectFields();
      if (!fields.title.trim()) { alert('Please enter a post title.'); return; }
      if (!fields.slug.trim()) { alert('Slug is required.'); return; }

      var user = D.getUser();
      var profile = D.getProfile();
      var heroUrl = await resolveHeroUrl(_editingId ? null : null);

      /* get existing hero_image_url if editing */
      var existingHero = null;
      if (_editingId && !_heroBlob) {
        var { data: existing } = await sb().from('blog_posts').select('hero_image_url').eq('id', _editingId).single();
        existingHero = existing && existing.hero_image_url;
      }
      heroUrl = await resolveHeroUrl(existingHero);

      var payload = {
        title: fields.title,
        slug: fields.slug,
        category: fields.category,
        excerpt: fields.excerpt,
        content: fields.content,
        hero_image_url: heroUrl,
        author_id: user.id,
        author_name: ((profile.first_name || '') + (profile.last_name ? ' ' + profile.last_name : '')).trim() || profile.full_name || profile.email,
        updated_at: new Date().toISOString()
      };

      var error;
      if (_editingId) {
        var res = await sb().from('blog_posts').update(payload).eq('id', _editingId);
        error = res.error;
      } else {
        payload.status = 'draft';
        var res2 = await sb().from('blog_posts').insert(payload).select('id').single();
        error = res2.error;
        if (!error && res2.data) { _editingId = res2.data.id; _slugLocked = false; }
      }

      if (error) { alert('Save failed: ' + error.message); return; }
      showToast('Draft saved.');
      _heroBlob = null;
    }

    /* ── Submit for review ──────────────────────────────────── */
    async function submitForReview() {
      await saveDraft();
      if (!_editingId) return;
      var { error } = await sb().from('blog_posts').update({ status: 'pending', admin_note: null }).eq('id', _editingId);
      if (error) { alert('Submit failed: ' + error.message); return; }
      showToast('Post submitted for review.');
      renderBlogList();
    }

    /* ── Delete post ────────────────────────────────────────── */
    async function deletePost(id, title) {
      if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
      var { error } = await sb().from('blog_posts').delete().eq('id', id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      showToast('Post deleted.');
      renderBlogList();
    }

    /* ── execCommand wrapper ─────────────────────────────────── */
    function execCmd(cmd) {
      var doc = edDoc(); if (!doc) return;
      _editorFrame.contentWindow.focus();
      doc.execCommand(cmd, false, null);
    }

    /* ── Public API (global for onclick handlers) ────────────── */
    window.mpBlog = {
      backToList:       renderBlogList,
      openEditor:       renderEditor,
      saveDraft:        saveDraft,
      submitForReview:  submitForReview,
      deletePost:       deletePost,
      applyBlock:       applyBlock,
      insertInline:     insertInline,
      insertBlockquote: insertBlockquote,
      insertButton:     insertButton,
      insertImage:      insertImage,
      onHeroFile:       onHeroFile,
      onTitleInput:     onTitleInput,
      execCmd:          execCmd
    };

    /* ── Register tab renderer ───────────────────────────────── */
    window.mpDashboard.render_blog = async function () {
      if (!D.isLeader()) {
        D.setContent('<p class="mp-empty">Blog posting is available to leaders and admins.</p>');
        return;
      }
      await renderBlogList();
    };

  }); /* end whenReady */

})();
