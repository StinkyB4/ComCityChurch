/**
 * DASHBOARD MODULE — Part D: Files tab
 * Requires dashboard.js to be loaded first.
 */
(function () {
  'use strict';

  var MAX_WAIT = 60, waited = 0;
  function tryRegister() {
    if (window.mpDashboard && window.mpDashboard.getSb) { register(); }
    else if (waited < MAX_WAIT) { waited++; setTimeout(tryRegister, 100); }
  }
  function register() { window.mpDashboard.render_files = renderFilesTab; }
  tryRegister();

  /* ── tree helpers ────────────────────────────────────────── */
  function findNode(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (String(nodes[i].id) === String(id)) return nodes[i];
      if (nodes[i].type === 'folder' && nodes[i].children) {
        var f = findNode(nodes[i].children, id);
        if (f) return f;
      }
    }
    return null;
  }

  function deleteNode(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (String(nodes[i].id) === String(id)) { nodes.splice(i, 1); return true; }
      if (nodes[i].type === 'folder' && nodes[i].children) {
        if (deleteNode(nodes[i].children, id)) return true;
      }
    }
    return false;
  }

  function gatherFolderOptions(nodes, depth) {
    var opts = '';
    (nodes || []).forEach(function (n) {
      if (n.type !== 'folder') return;
      opts += '<option value="' + window.mpDashboard.esc(n.id) + '">' + '-- '.repeat(depth) + window.mpDashboard.esc(n.name) + '</option>';
      if (n.children) opts += gatherFolderOptions(n.children, depth + 1);
    });
    return opts;
  }

  async function saveTree(sb, tree) {
    /* always one row */
    var { data: existing } = await sb.from('file_tree').select('id').limit(1).maybeSingle();
    if (existing) {
      await sb.from('file_tree').update({ tree }).eq('id', existing.id);
    } else {
      await sb.from('file_tree').insert({ tree });
    }
  }

  /* ── render tree HTML (recursive) ───────────────────────── */
  function renderTree(nodes, isAdmin, depth) {
    var D = window.mpDashboard;
    var html = '';
    (nodes || []).forEach(function (n) {
      var ind = depth * 20;
      if (n.type === 'folder') {
        html += '<li class="mp-tree-folder" style="--indent:' + ind + 'px">';
        html += '<div class="mp-tree-row mp-tree-folder-row" onclick="mpFolderToggle(this)">';
        html += '<span class="mp-tree-icon mp-folder-icon">📁</span>';
        html += '<span class="mp-tree-name">' + D.esc(n.name) + '</span>';
        html += '<span class="mp-folder-chevron">▶</span>';
        if (isAdmin) {
          html += '<span class="mp-tree-admin-actions">';
          html += '<button type="button" class="mp-btn mp-btn--small mp-tree-btn" onclick="event.stopPropagation();mpShowRename(\'' + D.esc(n.id) + '\',\'' + D.esc(n.name.replace(/'/g, "\\'")) + '\')">Rename</button>';
          html += '<button type="button" class="mp-btn mp-btn--small mp-tree-btn" onclick="event.stopPropagation();mpShowUpload(\'' + D.esc(n.id) + '\')">+ File</button>';
          html += '<button type="button" class="mp-btn mp-btn--small mp-tree-btn mp-btn--danger" onclick="event.stopPropagation();mpDeleteNode(\'' + D.esc(n.id) + '\',\'' + D.esc(n.name.replace(/'/g, "\\'")) + '\',\'folder\')">Delete</button>';
          html += '</span>';
        }
        html += '</div>';
        html += '<ul class="mp-tree-children" style="display:none;">';
        if (!n.children || !n.children.length) {
          html += '<li class="mp-tree-empty" style="padding-left:' + (ind + 36) + 'px">Empty folder</li>';
        } else {
          html += renderTree(n.children, isAdmin, depth + 1);
        }
        html += '</ul></li>';
      } else if (n.type === 'file') {
        html += '<li class="mp-tree-file" style="--indent:' + ind + 'px" data-name="' + D.esc((n.name + ' ' + (n.filename || '')).toLowerCase()) + '">';
        html += '<div class="mp-tree-row mp-tree-file-row">';
        html += '<span class="mp-tree-icon">📄</span>';
        html += '<span class="mp-tree-name">' + D.esc(n.name) + '</span>';
        if (n.filename) html += '<span class="mp-tree-filename">' + D.esc(n.filename) + '</span>';
        html += '<div class="mp-tree-file-actions">';
        html += '<a href="' + D.esc(n.url) + '" target="_blank" rel="noopener" class="mp-btn mp-btn--small">Open</a>';
        html += '<a href="' + D.esc(n.url) + '" download="' + D.esc(n.filename || n.name) + '" class="mp-btn mp-btn--small mp-btn--outline">Download</a>';
        if (isAdmin) html += '<button type="button" class="mp-btn mp-btn--small mp-btn--danger" onclick="mpDeleteNode(\'' + D.esc(String(n.id)) + '\',\'' + D.esc(n.name.replace(/'/g, "\\'")) + '\',\'file\')">Delete</button>';
        html += '</div></div></li>';
      } else if (n.type === 'link') {
        html += '<li class="mp-tree-file mp-tree-link" style="--indent:' + ind + 'px" data-name="' + D.esc(n.name.toLowerCase()) + '">';
        html += '<div class="mp-tree-row mp-tree-file-row">';
        html += '<span class="mp-tree-icon">🔗</span>';
        html += '<span class="mp-tree-name">' + D.esc(n.name) + '</span>';
        html += '<span class="mp-tree-filename mp-tree-link-label">External link</span>';
        html += '<div class="mp-tree-file-actions">';
        html += '<a href="' + D.esc(n.url) + '" target="_blank" rel="noopener" class="mp-btn mp-btn--small">Open</a>';
        if (isAdmin) {
          html += '<button type="button" class="mp-btn mp-btn--small mp-tree-btn" onclick="mpShowRename(\'' + D.esc(n.id) + '\',\'' + D.esc(n.name.replace(/'/g, "\\'")) + '\')">Rename</button>';
          html += '<button type="button" class="mp-btn mp-btn--small mp-btn--danger" onclick="mpDeleteNode(\'' + D.esc(String(n.id)) + '\',\'' + D.esc(n.name.replace(/'/g, "\\'")) + '\',\'link\')">Delete</button>';
        }
        html += '</div></div></li>';
      }
    });
    return html;
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDERER
     ══════════════════════════════════════════════════════════════ */
  async function renderFilesTab() {
    var D = window.mpDashboard;
    var _sb = D.getSb(), _isAdmin = D.isAdmin();

    var { data: treeRow } = await _sb.from('file_tree').select('*').limit(1).maybeSingle();
    var tree = (treeRow && treeRow.tree) ? treeRow.tree : [];
    var treeId = treeRow ? treeRow.id : null;

    /* store tree in window for mutations */
    window._fileTree   = tree;
    window._fileTreeId = treeId;

    var folderOpts = gatherFolderOptions(tree, 0);
    var html = '<h2 class="mp-tab-title">Files</h2>';

    /* admin management panel */
    if (_isAdmin) {
      html += '<details class="mp-admin-panel"><summary class="mp-admin-toggle">Manage Files &amp; Folders <span class="mp-admin-badge">Admin</span></summary><div class="mp-admin-body">';
      /* create folder */
      html += '<div class="mp-admin-section"><h4>Create New Folder</h4>';
      html += '<form id="folder-form" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Folder Name</label><input type="text" name="folder_name" required placeholder="e.g. Meeting Minutes"></div>';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Inside Folder <span class="mp-optional">(root if blank)</span></label><select name="folder_parent_id"><option value="">-- Root level --</option>' + folderOpts + '</select></div>';
      html += '<button type="submit" class="mp-btn mp-btn--primary" style="width:auto;">Create Folder</button></form></div>';
      /* upload file */
      html += '<div class="mp-admin-section" style="margin-top:16px;"><h4>Upload File</h4>';
      html += '<form id="upload-form" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Display Name</label><input type="text" name="upload_label" placeholder="Defaults to filename"></div>';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Upload To</label><select name="upload_folder_id"><option value="">-- Root level --</option>' + folderOpts + '</select></div>';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>File <span class="mp-required">*</span></label><input type="file" name="upload_file" id="upload-file-inp" required></div>';
      html += '<button type="submit" class="mp-btn mp-btn--primary" style="width:auto;">Upload</button></form></div>';
      /* add external link */
      html += '<div class="mp-admin-section" style="margin-top:16px;"><h4>Add External Link</h4>';
      html += '<form id="link-form" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Display Name <span class="mp-required">*</span></label><input type="text" name="link_label" required placeholder="e.g. 2024 Annual Report"></div>';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>URL <span class="mp-required">*</span></label><input type="url" name="link_url" required placeholder="https://drive.google.com/…"></div>';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>Inside Folder <span class="mp-optional">(root if blank)</span></label><select name="link_folder_id"><option value="">-- Root level --</option>' + folderOpts + '</select></div>';
      html += '<button type="submit" class="mp-btn mp-btn--primary" style="width:auto;">Add Link</button></form></div>';
      html += '</div></details>';
    }

    /* inline rename form (hidden) */
    if (_isAdmin) {
      html += '<div id="rename-panel" style="display:none;background:#fff;border:1.5px solid var(--mp-border);border-radius:8px;padding:16px;margin-bottom:12px;">';
      html += '<form id="rename-form" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;"><input type="hidden" name="rename_id" id="rename-id">';
      html += '<div class="mp-form-group" style="flex:1;margin:0;"><label>New Name</label><input type="text" name="rename_name" id="rename-name" required></div>';
      html += '<button type="submit" class="mp-btn mp-btn--primary mp-btn--small">Rename</button>';
      html += '<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="document.getElementById(\'rename-panel\').style.display=\'none\';">Cancel</button></form></div>';
    }

    /* search */
    html += '<div class="mp-search-wrap"><input type="text" id="file-search" placeholder="Search files…" class="mp-search-input" oninput="mpFilterFiles(this.value)"></div>';

    /* file tree */
    html += '<div id="file-tree-wrap">';
    if (!tree.length) {
      html += '<p class="mp-empty">No files or folders yet.</p>';
    } else {
      html += '<ul class="mp-tree-root">' + renderTree(tree, _isAdmin, 0) + '</ul>';
    }
    html += '</div>';

    D.setContent(html);

    /* ── wire folder form ── */
    var fform = document.getElementById('folder-form');
    if (fform) {
      fform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(fform);
        var name = (fd.get('folder_name') || '').trim(), parentId = fd.get('folder_parent_id') || '';
        if (!name) { alert('Folder name is required.'); return; }
        var tree2 = window._fileTree || [];
        var folder = { type: 'folder', id: 'fld_' + Date.now(), name, children: [] };
        if (parentId) {
          var parent = findNode(tree2, parentId);
          if (parent && parent.type === 'folder') { parent.children = parent.children || []; parent.children.push(folder); }
          else tree2.push(folder);
        } else {
          tree2.push(folder);
        }
        await saveTree(_sb, tree2);
        renderFilesTab();
      });
    }

    /* ── wire upload form ── */
    var uform = document.getElementById('upload-form');
    if (uform) {
      uform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(uform);
        var label = (fd.get('upload_label') || '').trim();
        var folderId = fd.get('upload_folder_id') || '';
        var file = document.getElementById('upload-file-inp');
        if (!file || !file.files || !file.files[0]) { alert('Please select a file.'); return; }
        var f = file.files[0];
        if (!label) label = f.name;
        var path = 'files/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var submitBtn = uform.querySelector('button[type=submit]'); if (submitBtn) submitBtn.disabled = true;
        var { data: upData, error: upErr } = await _sb.storage.from('member-files').upload(path, f);
        if (upErr) {
          /* fallback: try avatars bucket as a workaround if member-files doesn't exist */
          var { data: upData2, error: upErr2 } = await _sb.storage.from('avatars').upload(path, f);
          if (upErr2) { alert('Upload failed: ' + (upErr2.message || upErr.message)); if (submitBtn) submitBtn.disabled = false; return; }
          var { data: ud2 } = _sb.storage.from('avatars').getPublicUrl(path);
          var url2 = ud2 ? ud2.publicUrl : '';
          var node2 = { type: 'file', id: 'file_' + Date.now(), name: label, filename: f.name, url: url2, uploaded_at: Math.floor(Date.now() / 1000), uploaded_by: D.getProfile().id };
          var t2 = window._fileTree || [];
          if (folderId) { var p2 = findNode(t2, folderId); if (p2 && p2.type === 'folder') { p2.children = p2.children || []; p2.children.push(node2); } else t2.push(node2); } else t2.push(node2);
          await saveTree(_sb, t2); renderFilesTab(); return;
        }
        var { data: ud } = _sb.storage.from('member-files').getPublicUrl(path);
        var fileUrl = ud ? ud.publicUrl : '';
        var fileNode = { type: 'file', id: 'file_' + Date.now(), name: label, filename: f.name, url: fileUrl, uploaded_at: Math.floor(Date.now() / 1000), uploaded_by: D.getProfile().id };
        var tree3 = window._fileTree || [];
        if (folderId) {
          var pnode = findNode(tree3, folderId);
          if (pnode && pnode.type === 'folder') { pnode.children = pnode.children || []; pnode.children.push(fileNode); }
          else tree3.push(fileNode);
        } else {
          tree3.push(fileNode);
        }
        await saveTree(_sb, tree3);
        renderFilesTab();
      });
    }

    /* ── wire link form ── */
    var lform = document.getElementById('link-form');
    if (lform) {
      lform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(lform);
        var name = (fd.get('link_label') || '').trim();
        var url  = (fd.get('link_url')   || '').trim();
        var folderId = fd.get('link_folder_id') || '';
        if (!name) { alert('Display name is required.'); return; }
        if (!url)  { alert('URL is required.'); return; }
        var linkNode = { type: 'link', id: 'link_' + Date.now(), name: name, url: url, added_at: Math.floor(Date.now() / 1000), added_by: D.getProfile().id };
        var treeL = window._fileTree || [];
        if (folderId) {
          var pL = findNode(treeL, folderId);
          if (pL && pL.type === 'folder') { pL.children = pL.children || []; pL.children.push(linkNode); }
          else treeL.push(linkNode);
        } else {
          treeL.push(linkNode);
        }
        await saveTree(_sb, treeL);
        renderFilesTab();
      });
    }

    /* ── wire rename form ── */
    var rform = document.getElementById('rename-form');
    if (rform) {
      rform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(rform);
        var id = fd.get('rename_id'), name = (fd.get('rename_name') || '').trim();
        if (!id || !name) return;
        var tree4 = window._fileTree || [];
        var node = findNode(tree4, id);
        if (node) { node.name = name; await saveTree(_sb, tree4); }
        document.getElementById('rename-panel').style.display = 'none';
        renderFilesTab();
      });
    }
  }

  /* global file tree actions */
  window.mpFolderToggle = function (row) {
    var li = row.closest('.mp-tree-folder');
    var children = li ? li.querySelector('.mp-tree-children') : null;
    var chevron  = row.querySelector('.mp-folder-chevron');
    if (!children) return;
    var open = children.style.display === 'none';
    children.style.display = open ? '' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : '';
  };

  window.mpShowRename = function (id, name) {
    var panel = document.getElementById('rename-panel');
    document.getElementById('rename-id').value = id;
    document.getElementById('rename-name').value = name;
    if (panel) { panel.style.display = ''; document.getElementById('rename-name').focus(); }
  };

  window.mpShowUpload = function (folderId) {
    /* scroll to and open the upload panel, set folder */
    var panel = document.querySelector('#upload-form select[name=upload_folder_id]');
    if (panel) panel.value = folderId;
    var details = document.querySelector('.mp-admin-panel');
    if (details) details.open = true;
    var uinp = document.getElementById('upload-file-inp');
    if (uinp) uinp.click();
  };

  window.mpDeleteNode = async function (id, name, type) {
    if (!confirm('Delete ' + type + ' "' + name + '"?' + (type === 'folder' ? ' This will also delete all files inside it.' : ''))) return;
    var _sb2 = window.mpDashboard.getSb();
    var tree5 = window._fileTree || [];
    /* collect file URLs to delete from storage */
    if (type === 'file') {
      var node = findNode(tree5, id);
      /* deletion from storage: best effort */
      if (node && node.url) {
        var pathMatch = node.url.match(/\/([^/]+\/[^/]+)$/);
        if (pathMatch) {
          try { await _sb2.storage.from('member-files').remove([pathMatch[1]]); } catch (e) { /* ignore */ }
          try { await _sb2.storage.from('avatars').remove([pathMatch[1]]); } catch (e) { /* ignore */ }
        }
      }
    }
    deleteNode(tree5, id);
    await saveTree(_sb2, tree5);
    renderFilesTab();
  };

  window.mpFilterFiles = function (q) {
    q = (q || '').toLowerCase().trim();
    document.querySelectorAll('.mp-tree-file').forEach(function (li) {
      li.style.display = (!q || (li.dataset.name || '').indexOf(q) !== -1) ? '' : 'none';
    });
  };

})();
