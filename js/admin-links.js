/**
 * ADMIN — Link Page editor
 *
 * Adds the "Link Page" tab to /members/admin. Edits the public /links page:
 * colours, background, logo, headline, the link buttons and the social row.
 *
 * Two things worth knowing before changing this file:
 *
 * 1. The icon list is not defined here. It is read out of links.html at
 *    runtime — the sprite in its section 8 is the single source of truth, so
 *    adding a <symbol> there makes it appear in these dropdowns with no change
 *    to this file. The same sprite is injected into this page so the live
 *    preview can draw the icons.
 *
 * 2. Saving writes to link_page_settings and link_page_links. The public page
 *    treats those tables as authoritative and its own markup as the fallback.
 *    Run supabase/link-page-setup.sql once before this tab will do anything.
 */
(function () {
  'use strict';

  /* ── state ───────────────────────────────────────────────── */

  var settings = null;      /* the single settings row */
  var links = [];           /* working copy, both kinds */
  var originalIds = [];     /* to work out deletions on save */
  var icons = { button: [], social: [] };
  var dirty = false;
  var loaded = false;

  var DEFAULTS = {
    id: 1,
    headline: 'Commissioned City Church',
    tagline: 'For the Good of the City · For the Glory of Christ',
    logo_url: '/assets/logo.png', logo_size: 180, logo_plate: true,
    bg_type: 'color', bg_color: '#112E53', bg_image_url: '', bg_overlay: 0.45,
    btn_color: '#FFFFFF', btn_text_color: '#112E53',
    btn_style: 'solid', btn_radius: 999,
    font_color: '#FFFFFF',
    footer_text: '© Commissioned City Church · Winnipeg, MB'
  };

  /* ── plumbing ────────────────────────────────────────────── */

  function sb() {
    if (window._adminLinksSb) return window._adminLinksSb;
    if (!window.supabase) return null;
    window._adminLinksSb = window.supabase.createClient(
      window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return window._adminLinksSb;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    var t = document.getElementById('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'admin-toast show toast-success';
    setTimeout(function () { t.className = 'admin-toast'; }, 3800);
  }

  function fail(msg) {
    var t = document.getElementById('admin-toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.className = 'admin-toast show toast-error';
    setTimeout(function () { t.className = 'admin-toast'; }, 6000);
  }

  function markDirty() {
    dirty = true;
    var b = document.getElementById('lpx-save');
    if (b) { b.disabled = false; b.textContent = 'Save changes'; }
    var d = document.getElementById('lpx-dirty');
    if (d) d.style.visibility = 'visible';
  }

  /* Warn before losing edits to a page refresh or a tab change. */
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ── the icon sprite, borrowed from links.html ───────────── */

  function loadSprite() {
    if (document.getElementById('lpx-sprite')) return Promise.resolve();
    return fetch('/links')
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) throw new Error('no html');
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var syms = doc.querySelectorAll('svg symbol[id^="icon-"]');
        if (!syms.length) throw new Error('no symbols');

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'lpx-sprite';
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        syms.forEach(function (sym) {
          svg.appendChild(document.importNode(sym, true));
          var id = sym.id;
          if (id.indexOf('icon-social-') === 0) {
            icons.social.push(id.replace('icon-social-', ''));
          } else if (id !== 'icon-chevron' && id !== 'icon-arrow-out') {
            icons.button.push(id);
          }
        });
        document.body.appendChild(svg);
      })
      .catch(function () {
        /* Without the sprite the editor still works, just with no icon
           previews and a free-text icon field instead of a dropdown. */
        icons.button = [];
        icons.social = [];
      });
  }

  /* ── data ────────────────────────────────────────────────── */

  function load() {
    var c = sb();
    if (!c) return Promise.reject(new Error('Supabase client unavailable.'));

    return Promise.all([
      c.from('link_page_settings').select('*').eq('id', 1).maybeSingle(),
      c.from('link_page_links').select('*').order('kind', { ascending: false }).order('sort_order')
    ]).then(function (res) {
      var sRes = res[0], lRes = res[1];
      /* 42P01 = table missing: the SQL has not been run yet. */
      if ((sRes.error && sRes.error.code === '42P01') ||
          (lRes.error && lRes.error.code === '42P01')) {
        var e = new Error('setup');
        e.setup = true;
        throw e;
      }
      if (sRes.error) throw sRes.error;
      if (lRes.error) throw lRes.error;

      settings = sRes.data || JSON.parse(JSON.stringify(DEFAULTS));
      links = (lRes.data || []).map(function (l) { return Object.assign({}, l); });
      originalIds = links.map(function (l) { return l.id; }).filter(Boolean);
    });
  }

  function save() {
    var c = sb();
    var btn = document.getElementById('lpx-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    /* Renumber within each kind so order is contiguous and predictable. */
    var n = { button: 0, social: 0 };
    links.forEach(function (l) { l.sort_order = ++n[l.kind]; });

    var payload = {
      headline: settings.headline, tagline: settings.tagline,
      logo_url: settings.logo_url, logo_size: parseInt(settings.logo_size, 10) || 180,
      logo_plate: !!settings.logo_plate,
      bg_type: settings.bg_type, bg_color: settings.bg_color,
      bg_image_url: settings.bg_image_url || null,
      bg_overlay: parseFloat(settings.bg_overlay),
      btn_color: settings.btn_color, btn_text_color: settings.btn_text_color,
      btn_style: settings.btn_style, btn_radius: parseInt(settings.btn_radius, 10),
      font_color: settings.font_color, footer_text: settings.footer_text
    };

    var keptIds = links.map(function (l) { return l.id; }).filter(Boolean);
    var removed = originalIds.filter(function (id) { return keptIds.indexOf(id) === -1; });

    var jobs = [c.from('link_page_settings').update(payload).eq('id', 1)];

    links.forEach(function (l) {
      var row = {
        kind: l.kind, icon: l.icon || '', label: l.label || '',
        sublabel: l.sublabel || '', url: l.url || '',
        sort_order: l.sort_order, is_visible: !!l.is_visible, new_tab: !!l.new_tab
      };
      jobs.push(l.id
        ? c.from('link_page_links').update(row).eq('id', l.id)
        : c.from('link_page_links').insert(row).select().single());
    });

    if (removed.length) {
      jobs.push(c.from('link_page_links').delete().in('id', removed));
    }

    return Promise.all(jobs).then(function (results) {
      var bad = results.filter(function (r) { return r && r.error; });
      if (bad.length) throw bad[0].error;
      dirty = false;
      var d = document.getElementById('lpx-dirty');
      if (d) d.style.visibility = 'hidden';
      toast('Link page saved. Refresh /links to see it live.');
      return load().then(function () { renderBody(); });
    }).catch(function (err) {
      fail('Save failed: ' + (err.message || err));
      if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }
    });
  }

  /* ── background image upload ─────────────────────────────── */

  function uploadBg(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { fail('That is not an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { fail('Image is larger than 5MB. Please shrink it first.'); return; }

    var status = document.getElementById('lpx-upload-status');
    if (status) status.textContent = 'Uploading…';

    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    var path = 'bg-' + Date.now() + '.' + ext;

    sb().storage.from('link-page').upload(path, file, { contentType: file.type })
      .then(function (res) {
        if (res.error) throw res.error;
        var pub = sb().storage.from('link-page').getPublicUrl(path);
        settings.bg_image_url = pub.data.publicUrl;
        settings.bg_type = 'image';
        markDirty();
        renderBody();
        toast('Image uploaded.');
      })
      .catch(function (err) {
        if (status) status.textContent = '';
        fail('Upload failed: ' + (err.message || err) +
             (/bucket/i.test(err.message || '') ? ' — has link-page-setup.sql been run?' : ''));
      });
  }

  /* ── preview ─────────────────────────────────────────────── */

  function previewHtml() {
    var s = settings;
    var isImg = s.bg_type === 'image' && s.bg_image_url;
    var outline = s.btn_style === 'outline';

    var wrap = 'position:relative;border-radius:12px;overflow:hidden;padding:22px 16px 26px;text-align:center;'
      + 'background:' + esc(s.bg_color) + ';'
      + (isImg ? 'background-image:url(' + esc(s.bg_image_url) + ');background-size:cover;background-position:center;' : '');

    var html = '<div style="' + wrap + '">';
    if (isImg) {
      html += '<div style="position:absolute;inset:0;background:#000;opacity:' + esc(s.bg_overlay) + ';"></div>';
    }
    html += '<div style="position:relative;">';

    /* logo */
    var plate = s.logo_plate
      ? 'background:#fff;border-radius:16px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.2);' : '';
    var size = Math.round((parseInt(s.logo_size, 10) || 180) * 0.42);
    html += '<div style="width:' + size + 'px;height:' + size + 'px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;' + plate + '">'
         +  '<img src="' + esc(s.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:contain;">'
         +  '</div>';

    html += '<div style="font-family:Montserrat,sans-serif;font-weight:800;font-size:15px;line-height:1.2;color:' + esc(s.font_color) + ';">' + esc(s.headline) + '</div>';
    if (s.tagline) {
      html += '<div style="font-size:11px;margin-top:5px;opacity:.82;color:' + esc(s.font_color) + ';">' + esc(s.tagline) + '</div>';
    }

    /* buttons */
    var btnBase = 'display:flex;align-items:center;gap:8px;text-align:left;margin-top:8px;padding:8px 12px;'
      + 'border-radius:' + (parseInt(s.btn_radius, 10) || 0) + 'px;'
      + 'font-family:Montserrat,sans-serif;font-weight:700;font-size:11.5px;'
      + (outline
          ? 'background:transparent;border:2px solid ' + esc(s.btn_color) + ';color:' + esc(s.btn_color) + ';'
          : 'background:' + esc(s.btn_color) + ';border:2px solid transparent;color:' + esc(s.btn_text_color) + ';');

    html += '<div style="margin-top:12px;">';
    var shown = links.filter(function (l) { return l.kind === 'button' && l.is_visible; });
    if (!shown.length) {
      html += '<div style="opacity:.6;font-size:11px;color:' + esc(s.font_color) + ';padding:14px 0;">No visible buttons</div>';
    }
    shown.forEach(function (l) {
      html += '<div style="' + btnBase + '">';
      if (l.icon) {
        html += '<svg viewBox="0 0 24 24" style="width:15px;height:15px;flex:0 0 15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><use href="#' + esc(l.icon) + '"></use></svg>';
      }
      html += '<span style="flex:1;min-width:0;"><span style="display:block;">' + esc(l.label || '(no label)') + '</span>';
      if (l.sublabel) html += '<span style="display:block;font-family:inherit;font-weight:400;font-size:10px;opacity:.72;margin-top:1px;">' + esc(l.sublabel) + '</span>';
      html += '</span></div>';
    });
    html += '</div>';

    /* socials */
    var socs = links.filter(function (l) { return l.kind === 'social' && l.is_visible; });
    if (socs.length) {
      html += '<div style="display:flex;justify-content:center;gap:7px;margin-top:14px;">';
      socs.forEach(function (l) {
        html += '<span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;'
             +  'border:1.5px solid currentColor;opacity:.62;color:' + esc(s.font_color) + ';">'
             +  '<svg viewBox="0 0 24 24" style="width:14px;height:14px;"><use href="#icon-social-' + esc(l.icon || 'mail') + '"></use></svg>'
             +  '</span>';
      });
      html += '</div>';
    }

    if (s.footer_text) {
      html += '<div style="margin-top:12px;font-size:9.5px;opacity:.62;color:' + esc(s.font_color) + ';">' + esc(s.footer_text) + '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function refreshPreview() {
    var el = document.getElementById('lpx-preview');
    if (el) el.innerHTML = previewHtml();
  }

  /* ── form pieces ─────────────────────────────────────────── */

  function colorField(label, key, hint) {
    var v = settings[key] || '#000000';
    return '<div class="lpx-field">'
      + '<label>' + esc(label) + '</label>'
      + '<div class="lpx-color">'
      +   '<input type="color" value="' + esc(v) + '" data-color-for="' + key + '" aria-label="' + esc(label) + ' colour picker">'
      +   '<input type="text" value="' + esc(v) + '" data-hex-for="' + key + '" spellcheck="false" aria-label="' + esc(label) + ' hex code">'
      + '</div>'
      + (hint ? '<span class="lpx-hint">' + esc(hint) + '</span>' : '')
      + '</div>';
  }

  function iconSelect(l, i) {
    if (!icons.button.length) {
      return '<input type="text" value="' + esc(l.icon) + '" data-link="' + i + '" data-key="icon" placeholder="icon-pin">';
    }
    var out = '<select data-link="' + i + '" data-key="icon"><option value="">(no icon)</option>';
    icons.button.forEach(function (id) {
      out += '<option value="' + esc(id) + '"' + (l.icon === id ? ' selected' : '') + '>'
           + esc(id.replace('icon-', '')) + '</option>';
    });
    return out + '</select>';
  }

  function socialSelect(l, i) {
    if (!icons.social.length) {
      return '<input type="text" value="' + esc(l.icon) + '" data-link="' + i + '" data-key="icon" placeholder="instagram">';
    }
    var out = '<select data-link="' + i + '" data-key="icon">';
    icons.social.forEach(function (id) {
      out += '<option value="' + esc(id) + '"' + (l.icon === id ? ' selected' : '') + '>' + esc(id) + '</option>';
    });
    return out + '</select>';
  }

  function linkRow(l, i, isSocial) {
    var h = '<div class="lpx-row' + (l.is_visible ? '' : ' lpx-row--hidden') + '">';

    h += '<div class="lpx-row-move">'
      +  '<button type="button" class="lpx-icon-btn" onclick="adminLinks.move(' + i + ',-1)" aria-label="Move up" title="Move up">&#9650;</button>'
      +  '<button type="button" class="lpx-icon-btn" onclick="adminLinks.move(' + i + ',1)" aria-label="Move down" title="Move down">&#9660;</button>'
      +  '</div>';

    h += '<div class="lpx-row-fields">';
    if (isSocial) {
      h += '<div class="lpx-row-grid lpx-row-grid--social">'
        +  '<label>Platform' + socialSelect(l, i) + '</label>'
        +  '<label>Address<input type="url" value="' + esc(l.url) + '" data-link="' + i + '" data-key="url" placeholder="https://instagram.com/yourhandle"></label>'
        +  '<label>Screen-reader label<input type="text" value="' + esc(l.label) + '" data-link="' + i + '" data-key="label" placeholder="Instagram"></label>'
        +  '</div>';
    } else {
      h += '<div class="lpx-row-grid">'
        +  '<label>Icon' + iconSelect(l, i) + '</label>'
        +  '<label>Button text<input type="text" value="' + esc(l.label) + '" data-link="' + i + '" data-key="label" placeholder="Plan a Visit"></label>'
        +  '<label>Link to<input type="text" value="' + esc(l.url) + '" data-link="' + i + '" data-key="url" placeholder="/visit"></label>'
        +  '</div>'
        +  '<label class="lpx-wide">Small line underneath <span class="lpx-hint">optional, keep it short so it fits one line on a phone</span>'
        +  '<input type="text" value="' + esc(l.sublabel) + '" data-link="' + i + '" data-key="sublabel"></label>';
    }

    h += '<div class="lpx-row-toggles">'
      +  '<label class="lpx-check"><input type="checkbox" data-link="' + i + '" data-key="is_visible"' + (l.is_visible ? ' checked' : '') + '> Show on the page</label>'
      +  '<label class="lpx-check"><input type="checkbox" data-link="' + i + '" data-key="new_tab"' + (l.new_tab ? ' checked' : '') + '> Opens in a new tab</label>'
      +  '<button type="button" class="mp-btn mp-btn--small mp-btn--danger" onclick="adminLinks.remove(' + i + ')">Delete</button>'
      +  '</div>';

    h += '</div></div>';
    return h;
  }

  /* ── panel ───────────────────────────────────────────────── */

  function renderBody() {
    var panel = document.getElementById('tab-links');
    if (!panel) return;
    var s = settings;

    var h = '<div class="section-header" style="margin-bottom:1rem;">'
      + '<h2>Link Page</h2>'
      + '<a href="/links" target="_blank" rel="noopener" class="mp-btn mp-btn--small" style="background:#e5ecf8;color:#112E53;text-decoration:none;">Open /links &#8599;</a>'
      + '</div>'
      + '<p class="lpx-intro">This is the page behind the link in our Instagram bio and the printed QR code. '
      + 'It is not in any menu on the site. Changes go live as soon as you save.</p>';

    h += '<div class="lpx-layout">';

    /* ---- left: the form ---- */
    h += '<div class="lpx-form">';

    h += '<fieldset class="mp-fieldset"><legend>Heading</legend>'
      +  '<div class="lpx-field"><label>Church name</label><input type="text" value="' + esc(s.headline) + '" data-set="headline"></div>'
      +  '<div class="lpx-field"><label>Tagline</label><input type="text" value="' + esc(s.tagline) + '" data-set="tagline"><span class="lpx-hint">Leave empty to hide it</span></div>'
      +  '<div class="lpx-field"><label>Logo address</label><input type="text" value="' + esc(s.logo_url) + '" data-set="logo_url"></div>'
      +  '<div class="lpx-field"><label>Logo size — <b>' + esc(s.logo_size) + 'px</b></label>'
      +    '<input type="range" min="100" max="280" step="10" value="' + esc(s.logo_size) + '" data-set="logo_size"></div>'
      +  '<label class="lpx-check"><input type="checkbox" data-set="logo_plate"' + (s.logo_plate ? ' checked' : '') + '> White plate behind the logo'
      +    '<span class="lpx-hint">Our logo is dark artwork on a see-through background, so it needs this on a dark page.</span></label>'
      +  '</fieldset>';

    h += '<fieldset class="mp-fieldset"><legend>Background</legend>'
      +  '<div class="lpx-field"><label>Type</label><select data-set="bg_type">'
      +    '<option value="color"' + (s.bg_type === 'color' ? ' selected' : '') + '>Plain colour</option>'
      +    '<option value="image"' + (s.bg_type === 'image' ? ' selected' : '') + '>Photo</option>'
      +  '</select></div>'
      +  colorField('Background colour', 'bg_color', s.bg_type === 'image' ? 'Shows while the photo loads' : '');

    if (s.bg_type === 'image') {
      h += '<div class="lpx-field"><label>Photo</label>'
        +  '<input type="file" accept="image/*" onchange="adminLinks.uploadBg(this)">'
        +  '<span class="lpx-hint" id="lpx-upload-status">Or paste an address below. Max 5MB.</span></div>'
        +  '<div class="lpx-field"><input type="text" value="' + esc(s.bg_image_url || '') + '" data-set="bg_image_url" placeholder="/assets/media/heroes/home-4.jpg"></div>'
        +  '<div class="lpx-field"><label>Darken the photo — <b>' + esc(s.bg_overlay) + '</b></label>'
        +  '<input type="range" min="0" max="0.9" step="0.05" value="' + esc(s.bg_overlay) + '" data-set="bg_overlay">'
        +  '<span class="lpx-hint">Raise this if the writing is hard to read on top of the photo.</span></div>';
    }
    h += '</fieldset>';

    h += '<fieldset class="mp-fieldset"><legend>Buttons and text</legend>'
      +  colorField('Button colour', 'btn_color')
      +  colorField('Writing inside the buttons', 'btn_text_color', 'Must contrast strongly with the button colour')
      +  colorField('Heading and footer colour', 'font_color')
      +  '<div class="lpx-field"><label>Button style</label><select data-set="btn_style">'
      +    '<option value="solid"' + (s.btn_style === 'solid' ? ' selected' : '') + '>Filled in</option>'
      +    '<option value="outline"' + (s.btn_style === 'outline' ? ' selected' : '') + '>Outlined</option>'
      +  '</select></div>'
      +  '<div class="lpx-field"><label>Corner rounding — <b>' + esc(s.btn_radius) + 'px</b></label>'
      +    '<input type="range" min="0" max="999" step="1" value="' + esc(s.btn_radius) + '" data-set="btn_radius">'
      +    '<span class="lpx-hint">999 is a full pill, 14 is a soft rectangle, 0 is square.</span></div>'
      +  '<div class="lpx-field"><label>Footer line</label><input type="text" value="' + esc(s.footer_text) + '" data-set="footer_text"></div>'
      +  '</fieldset>';

    /* buttons list */
    h += '<fieldset class="mp-fieldset"><legend>Buttons</legend>';
    var buttons = links.filter(function (l) { return l.kind === 'button'; });
    if (!buttons.length) h += '<p class="lpx-hint">No buttons yet.</p>';
    links.forEach(function (l, i) { if (l.kind === 'button') h += linkRow(l, i, false); });
    h += '<button type="button" class="mp-btn mp-btn--small mp-btn--outline" onclick="adminLinks.add(\'button\')">+ Add a button</button>'
      +  '</fieldset>';

    /* socials list */
    h += '<fieldset class="mp-fieldset"><legend>Social icons</legend>';
    var socs = links.filter(function (l) { return l.kind === 'social'; });
    if (!socs.length) h += '<p class="lpx-hint">No social icons yet.</p>';
    links.forEach(function (l, i) { if (l.kind === 'social') h += linkRow(l, i, true); });
    h += '<button type="button" class="mp-btn mp-btn--small mp-btn--outline" onclick="adminLinks.add(\'social\')">+ Add a social icon</button>'
      +  '</fieldset>';

    h += '</div>';  /* /lpx-form */

    /* ---- right: preview ---- */
    h += '<div class="lpx-side">'
      +  '<div class="lpx-sticky">'
      +    '<div class="lpx-phone"><div id="lpx-preview"></div></div>'
      +    '<p class="lpx-hint" style="text-align:center;">Live preview. Roughly a phone screen.</p>'
      +    '<button type="button" class="mp-btn mp-btn--primary lpx-save" id="lpx-save" onclick="adminLinks.save()" disabled>Saved</button>'
      +    '<p class="lpx-hint lpx-dirty" id="lpx-dirty" style="visibility:hidden;text-align:center;">Unsaved changes</p>'
      +  '</div></div>';

    h += '</div>';
    panel.innerHTML = h;
    refreshPreview();
  }

  function renderSetupNotice() {
    var panel = document.getElementById('tab-links');
    panel.innerHTML = '<div class="section-header" style="margin-bottom:1rem;"><h2>Link Page</h2></div>'
      + '<div class="mp-alert mp-alert--warning">'
      + '<b>One-time setup needed.</b>'
      + '<p>The database tables for this page have not been created yet. Open the Supabase dashboard, '
      + 'go to the SQL editor, and run the contents of <code>supabase/link-page-setup.sql</code> from the '
      + 'website repository. Then reload this page.</p>'
      + '<p>Until then, <a href="/links" target="_blank" rel="noopener">/links</a> keeps working and shows '
      + 'the built-in defaults written into <code>links.html</code>.</p>'
      + '</div>';
  }

  /* ── events ──────────────────────────────────────────────── */

  function bind() {
    var panel = document.getElementById('tab-links');
    if (!panel || panel._lpxBound) return;
    panel._lpxBound = true;

    /* One delegated handler for the whole form. Re-rendering on every
       keystroke would steal focus, so only inputs that change the shape of
       the form trigger a re-render; the rest just update the preview. */
    panel.addEventListener('input', onChange);
  }

  function onChange(e) {
    var t = e.target;
    if (!t) return;
    var root = document.getElementById('tab-links');

    var colorFor = t.getAttribute('data-color-for');
    var hexFor   = t.getAttribute('data-hex-for');
    var setKey   = t.getAttribute('data-set');
    var linkIdx  = t.getAttribute('data-link');

    /* colour picker and hex box, kept in step with each other */
    if (colorFor || hexFor) {
      var ckey = colorFor || hexFor;
      settings[ckey] = t.value;
      if (!hexFor || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t.value)) {
        var mate = root.querySelector(colorFor
          ? '[data-hex-for="' + ckey + '"]' : '[data-color-for="' + ckey + '"]');
        if (mate && mate.value !== t.value) mate.value = t.value;
      }
      markDirty(); refreshPreview();
      return;
    }

    if (setKey) {
      settings[setKey] = t.type === 'checkbox' ? t.checked : t.value;
      markDirty();

      /* A slider fires this on every pixel of the drag. Rebuilding the form
         here would rip the slider out from under the pointer, so only the
         number in its own label is updated. */
      if (t.type === 'range') {
        var b = t.parentNode.querySelector('label b');
        if (b) b.textContent = setKey === 'bg_overlay' ? t.value : t.value + 'px';
        refreshPreview();
        return;
      }
      /* Switching to a photo background swaps whole fields in and out, so
         this one genuinely needs the form rebuilt. */
      if (setKey === 'bg_type') { renderBody(); return; }
      refreshPreview();
      return;
    }

    if (linkIdx !== null && linkIdx !== '') {
      var i = parseInt(linkIdx, 10);
      var k = t.getAttribute('data-key');
      if (!links[i] || !k) return;
      links[i][k] = t.type === 'checkbox' ? t.checked : t.value;
      markDirty();
      /* Dim the row in place rather than re-rendering, so the checkbox
         keeps focus. */
      if (k === 'is_visible') {
        var row = t.closest('.lpx-row');
        if (row) row.classList.toggle('lpx-row--hidden', !t.checked);
      }
      refreshPreview();
    }
  }

  /* ── list operations ─────────────────────────────────────── */

  function add(kind) {
    var last = -1;
    links.forEach(function (l, i) { if (l.kind === kind) last = i; });
    var row = {
      kind: kind, icon: kind === 'social' ? (icons.social[0] || 'mail') : '',
      label: '', sublabel: '', url: '',
      sort_order: 999, is_visible: true, new_tab: kind === 'social'
    };
    links.splice(last + 1, 0, row);
    markDirty();
    renderBody();
  }

  function remove(i) {
    var l = links[i];
    if (!l) return;
    if (!confirm('Delete "' + (l.label || 'this item') + '"? This cannot be undone once you save.')) return;
    links.splice(i, 1);
    markDirty();
    renderBody();
  }

  /* Moves within the item's own kind, so a button can never be reordered
     into the middle of the social icons. */
  function move(i, dir) {
    var l = links[i];
    if (!l) return;
    var siblings = [];
    links.forEach(function (x, idx) { if (x.kind === l.kind) siblings.push(idx); });
    var at = siblings.indexOf(i);
    var swapWith = siblings[at + dir];
    if (swapWith === undefined) return;
    links[i] = links[swapWith];
    links[swapWith] = l;
    markDirty();
    renderBody();
  }

  /* ── styles ──────────────────────────────────────────────── */

  function injectCss() {
    if (document.getElementById('lpx-css')) return;
    var st = document.createElement('style');
    st.id = 'lpx-css';
    st.textContent = [
      '.lpx-intro{color:#5C718E;font-size:.92rem;margin:0 0 1.25rem;max-width:60ch;}',
      '.lpx-layout{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap;}',
      '.lpx-form{flex:1 1 460px;min-width:320px;}',
      '.lpx-side{flex:0 0 300px;}',
      '@media (max-width:900px){.lpx-side{flex:1 1 100%;order:-1;}}',
      '.lpx-sticky{position:sticky;top:16px;}',
      '.lpx-phone{border:1px solid #dde3eb;border-radius:16px;padding:10px;background:#f7f8fa;}',
      '.lpx-save{width:100%;margin-top:10px;}',
      '.lpx-dirty{color:#b35309;font-weight:600;margin-top:6px;}',
      '.lpx-field{margin-bottom:14px;}',
      '.lpx-field > label{display:block;font-size:.85rem;font-weight:600;color:#5C718E;margin-bottom:5px;}',
      '.lpx-field input[type=text],.lpx-field input[type=url],.lpx-field select{display:block;width:100%;padding:9px 12px;border:1.5px solid #dde3eb;border-radius:6px;font-size:.9rem;font-family:inherit;background:#fff;}',
      '.lpx-field input[type=range]{width:100%;}',
      '.lpx-hint{display:block;font-size:.78rem;color:#8a97a8;margin-top:4px;font-weight:400;}',
      '.lpx-color{display:flex;gap:8px;align-items:center;}',
      '.lpx-color input[type=color]{width:44px;height:38px;padding:2px;border:1.5px solid #dde3eb;border-radius:6px;background:#fff;cursor:pointer;flex:none;}',
      '.lpx-color input[type=text]{flex:1;padding:9px 12px;border:1.5px solid #dde3eb;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:.85rem;}',
      '.lpx-check{display:block;font-size:.85rem;color:#3a4756;margin:8px 0;}',
      '.lpx-check input{margin-right:6px;}',
      '.lpx-row{display:flex;gap:10px;padding:12px;border:1.5px solid #e6eaf0;border-radius:8px;margin-bottom:10px;background:#fcfdfe;}',
      '.lpx-row--hidden{opacity:.55;background:#f4f5f7;}',
      '.lpx-row-move{display:flex;flex-direction:column;gap:4px;}',
      '.lpx-icon-btn{width:26px;height:24px;border:1px solid #dde3eb;background:#fff;border-radius:4px;cursor:pointer;color:#5C718E;font-size:10px;line-height:1;}',
      '.lpx-icon-btn:hover{background:#eef2f8;color:#112E53;}',
      '.lpx-row-fields{flex:1;min-width:0;}',
      '.lpx-row-grid{display:grid;grid-template-columns:150px 1fr 1fr;gap:8px;}',
      '.lpx-row-grid--social{grid-template-columns:150px 1fr 1fr;}',
      '@media (max-width:700px){.lpx-row-grid,.lpx-row-grid--social{grid-template-columns:1fr;}}',
      '.lpx-row-fields label{display:block;font-size:.78rem;font-weight:600;color:#5C718E;}',
      '.lpx-row-fields input,.lpx-row-fields select{display:block;width:100%;margin-top:3px;padding:7px 9px;border:1.5px solid #dde3eb;border-radius:5px;font-size:.85rem;font-family:inherit;background:#fff;}',
      '.lpx-wide{margin-top:8px;display:block;}',
      '.lpx-row-toggles{display:flex;align-items:center;gap:16px;margin-top:10px;flex-wrap:wrap;}',
      '.lpx-row-toggles .lpx-check{margin:0;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── entry point ─────────────────────────────────────────── */

  function show() {
    var p = document.getElementById('tab-links');
    if (!p) return;
    injectCss();

    if (loaded) { renderBody(); bind(); return; }

    p.innerHTML = '<p class="loading" style="color:#5C718E;">Loading&hellip;</p>';
    loadSprite()
      .then(load)
      .then(function () {
        loaded = true;
        renderBody();
        bind();
      })
      .catch(function (err) {
        if (err && err.setup) { renderSetupNotice(); return; }
        p.innerHTML = '<div class="mp-alert mp-alert--error"><b>Could not load the link page settings.</b>'
          + '<p>' + esc(err && err.message ? err.message : String(err)) + '</p></div>';
      });
  }

  window.adminLinks = {
    show: show, save: save, add: add, remove: remove, move: move, uploadBg: uploadBg
  };

  /* Wrap admin.js's switchTab, exactly as admin-blog.js does. */
  document.addEventListener('DOMContentLoaded', function () {
    var orig = window.switchTab;
    window.switchTab = function (tab) {
      if (tab === 'links') {
        document.querySelectorAll('.admin-tab-panel').forEach(function (el) { el.style.display = 'none'; });
        var mine = document.getElementById('tab-links');
        if (mine) mine.style.display = '';
        document.querySelectorAll('#admin-sub-nav a[data-tab]').forEach(function (a) {
          a.classList.toggle('active', a.dataset.tab === 'links');
        });
        show();
        return;
      }
      if (typeof orig === 'function') orig(tab);
    };
  });
})();
