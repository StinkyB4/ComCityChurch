/**
 * COMMISSIONED CITY CHURCH — MEMBERS PORTAL DASHBOARD
 * Step 1 of 5: Core module — init, routing, Welcome tab, Profile tab.
 * Tab renderers for Directory/MCs/Teams/Schedule/Files/Admin/Email
 * are loaded from separate files (dashboard-tabs.js etc.) which register
 * themselves onto window.mpDashboard before this file finishes booting.
 */
(function () {
  'use strict';

  /* ── shared state (exposed for sub-modules) ─────────────────── */
  var _sb       = null;
  var _profile  = null;
  var _user     = null;
  var _isAdmin  = false;
  var _isLeader = false;   // true for role='team' OR role='admin'
  var _ledMCIds    = [];   // missional_community IDs this user leads
  var _ledTeamIds  = [];   // team IDs this user leads

  /* ── avatar cropper state ───────────────────────────────────── */
  var _cropperInstance = null;
  var _cropCallback    = null;

  /* ── tab labels ─────────────────────────────────────────────── */
  var TAB_LABELS = {
    welcome:'Welcome', profile:'My Profile', directory:'Directory',
    mcs:'MCs', teams:'Teams', schedule:'Schedule', master:'Master Schedule', files:'Files',
    email:'Email', admin:'Admin', blog:'Blog'
  };

  /* ══════════════════════════════════════════════════════════════
     SHARED UTILITIES  (also used by sub-module files)
     ══════════════════════════════════════════════════════════════ */

  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtDate(d){
    if(!d) return '';
    var dt = new Date(d+'T12:00:00');
    return isNaN(dt.getTime()) ? d
      : dt.toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  }

  function getInitials(p){
    if(!p) return '?';
    var f=(p.first_name||'').charAt(0);
    var l=(p.last_name||'').charAt(0);
    return (f+l).toUpperCase() || (p.full_name||'?').charAt(0).toUpperCase();
  }

  function renderAvatar(initials, photoUrl, cls){
    cls = 'mp-avatar'+(cls?' '+cls:'');
    if(photoUrl) return '<div class="'+esc(cls)+' mp-avatar--photo"><img src="'+esc(photoUrl)+'" alt="" class="mp-avatar-img"></div>';
    return '<div class="'+esc(cls)+'">'+esc(initials)+'</div>';
  }

  function coupleDisplayName(a, b){
    var af=a.first_name||a.full_name||'', bf=b.first_name||b.full_name||'';
    var al=a.last_name||'', bl=b.last_name||'';
    if(al&&bl&&al.toLowerCase()===bl.toLowerCase()) return af+' & '+bf+' '+al;
    return (af+(al?' '+al:''))+' & '+(bf+(bl?' '+bl:''));
  }

  function alertHtml(msg,type){
    return '<div class="mp-alert mp-alert--'+esc(type||'error')+'" style="margin-bottom:16px;">'+msg+'</div>';
  }

  function showToast(msg){
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#112E53;color:#fff;padding:12px 20px;border-radius:8px;font-size:0.88rem;font-family:sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;max-width:340px;text-align:center;transition:opacity .4s;';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ t.remove(); }, 400); }, 4600);
  }
  window.showToast = showToast;

  function setContent(html){
    var c=document.getElementById('mp-content'); if(c) c.innerHTML=html;
  }

  function showLoading(){
    setContent('<div style="padding:60px 40px;text-align:center;color:#aaa;"><div class="mp-spinner"></div></div>');
  }

  function formatPhone(raw){
    raw=(raw||'').replace(/\D/g,'').slice(0,10);
    if(raw.length>=7) return raw.slice(0,3)+'-'+raw.slice(3,6)+'-'+raw.slice(6);
    if(raw.length>=4) return raw.slice(0,3)+'-'+raw.slice(3);
    return raw;
  }

  function pwEyeSvg(){
    return '<svg class="mp-eye-show" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      +'<svg class="mp-eye-hide" style="display:none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }

  function provinceSelect(name, selected){
    var provs=['AB:Alberta','BC:British Columbia','MB:Manitoba','NB:New Brunswick',
      'NL:Newfoundland and Labrador','NS:Nova Scotia','NT:Northwest Territories',
      'NU:Nunavut','ON:Ontario','PE:Prince Edward Island','QC:Quebec',
      'SK:Saskatchewan','YT:Yukon'];
    return '<select name="'+esc(name)+'" required><option value="">— Select —</option>'
      +provs.map(function(p){ var kv=p.split(':');
        return '<option value="'+kv[0]+'"'+(kv[0]===selected?' selected':'')+'>'+kv[1]+'</option>'; }).join('')
      +'</select>';
  }

  function phoneSelect(name, selected){
    return '<select name="'+esc(name)+'" class="mp-phone-type">'
      +['Cell','Home','Work'].map(function(t){
        return '<option value="'+t+'"'+(t===selected?' selected':'')+'>'+t+'</option>';
      }).join('')+'</select>';
  }

  function dlRow(label, val){
    return '<dt>'+label+'</dt><dd>'+val+'</dd>';
  }

  function collectFiles(nodes, arr){
    (nodes||[]).forEach(function(n){
      if(n.type==='file'||n.type==='link') arr.push(n);
      else if(n.type==='folder'&&n.children) collectFiles(n.children, arr);
    });
  }

  function sanitizeBody(html){
    var d=document.createElement('div'); d.innerHTML=html||''; return d.innerHTML;
  }

  async function callEdge(name, payload){
    try{
      var res = await _sb.functions.invoke(name,{body:payload});
      return res && res.data;
    }
    catch(e){ console.warn('Edge fn '+name+':', e.message); }
  }

  /* ── Avatar crop helpers ─────────────────────────────────────── */
  function loadCropperJS(cb){
    if(window.Cropper){ cb(); return; }
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css';
    document.head.appendChild(link);
    var sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js';
    sc.onload=cb;
    document.head.appendChild(sc);
  }

  function ensureCropModal(){
    if(document.getElementById('mp-crop-modal')) return;
    var m=document.createElement('div');
    m.id='mp-crop-modal'; m.className='mp-modal-overlay'; m.style.display='none';
    m.innerHTML='<div class="mp-modal-box mp-crop-box">'
      +'<h3 class="mp-modal-title" style="margin:0 0 16px;">Adjust Photo</h3>'
      +'<div class="mp-crop-wrap"><img id="mp-crop-img" src="" alt=""></div>'
      +'<p class="mp-hint" style="text-align:center;margin:10px 0 0;">Drag to reposition &nbsp;·&nbsp; scroll or pinch to zoom</p>'
      +'<div style="display:flex;gap:10px;margin-top:16px;">'
      +'<button type="button" class="mp-btn mp-btn--primary" style="flex:1;" onclick="mpCropApply()">Use This Photo</button>'
      +'<button type="button" class="mp-btn mp-btn--secondary" onclick="mpCropCancel()">Cancel</button>'
      +'</div></div>';
    document.body.appendChild(m);
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════ */
  async function init(){
    /* wait for Supabase CDN */
    var t=0;
    while(!window.supabase && t<60){ await new Promise(r=>setTimeout(r,100)); t++; }
    if(!window.supabase){
      setContent('<p class="mp-empty">Could not load authentication library.</p>'); return;
    }

    var url=window.SUPABASE_URL, key=window.SUPABASE_ANON_KEY;
    if(!url||url==='{{ SUPABASE_URL }}'){
      setContent('<p class="mp-empty">Supabase not configured. Set SUPABASE_URL in app settings.</p>'); return;
    }
    _sb = window.supabase.createClient(url, key);

    /* auth check */
    var { data:{ user } } = await _sb.auth.getUser();
    if(!user){ window.location.href='/members/'; return; }
    _user = user;

    /* profile check */
    var { data:prof } = await _sb.from('profiles').select('*').eq('id',user.id).single();
    if(!prof){ window.location.href='/members/'; return; }
    if(prof.status!=='approved'){ window.location.href='/members/pending.html'; return; }
    _profile  = prof;
    _isAdmin  = (prof.role==='admin');
    _isLeader = (prof.role==='team' || prof.role==='admin');

    /* upload avatar that was deferred at registration (no session when email confirmation is required) */
    await uploadDeferredAvatar();

    /* load which MCs/Teams this user leads */
    await loadLeaderContext();

    setupShell();
    setupLogout();
    loadNavSubmenus();
    if(_isAdmin) {
      loadPendingBadge();
      /* realtime: update badge + refresh welcome tab when a new pending profile is inserted */
      _sb.channel('pending-registrations')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'profiles',
          filter: 'status=eq.pending'
        }, function(payload) {
          loadPendingBadge();
          var curTab = new URLSearchParams(window.location.search).get('tab') || 'welcome';
          if(curTab === 'welcome') renderWelcomeTab();
          var name = (payload.new && (payload.new.full_name || payload.new.email)) || 'Someone';
          showToast('New member registration: ' + name);
        })
        .subscribe();
    }

    /* initial tab from URL */
    var params = new URLSearchParams(window.location.search);
    navigate(params.get('tab')||'welcome', true);

    window.addEventListener('popstate', function(){
      var p=new URLSearchParams(window.location.search);
      renderTab(p.get('tab')||'welcome');
    });
  }

  async function uploadDeferredAvatar(){
    var b64, uid;
    try { b64 = localStorage.getItem('mp_pending_avatar_b64'); uid = localStorage.getItem('mp_pending_avatar_uid'); }
    catch(e) { return; }
    if (!b64 || uid !== _user.id || _profile.avatar_url) return;
    try {
      localStorage.removeItem('mp_pending_avatar_b64');
      localStorage.removeItem('mp_pending_avatar_uid');
      var res = await fetch(b64);
      var blob = await res.blob();
      var path = _user.id + '/' + Date.now() + '.jpg';
      var { error: upErr } = await _sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (!upErr) {
        var { data: ud } = _sb.storage.from('avatars').getPublicUrl(path);
        if (ud && ud.publicUrl) {
          await _sb.from('profiles').update({ avatar_url: ud.publicUrl }).eq('id', _user.id);
          _profile.avatar_url = ud.publicUrl;
        }
      }
    } catch(e) { console.warn('Deferred avatar upload failed:', e); }
  }

  async function loadLeaderContext(){
    /* Find MCs this user leads */
    var { data:ledMCs } = await _sb.from('missional_communities').select('id').eq('leader_id',_user.id);
    _ledMCIds = (ledMCs||[]).map(function(r){ return r.id; });

    /* Find Teams this user leads (via team_members role='leader' OR teams.leader_id) */
    var [{ data:ledTeams1 }, { data:ledTeams2 }] = await Promise.all([
      _sb.from('teams').select('id').eq('leader_id',_user.id),
      _sb.from('team_members').select('team_id').eq('member_id',_user.id).eq('role','leader')
    ]);
    var ids1 = (ledTeams1||[]).map(function(r){ return r.id; });
    var ids2 = (ledTeams2||[]).map(function(r){ return r.team_id; });
    _ledTeamIds = ids1.concat(ids2.filter(function(id){ return ids1.indexOf(id)===-1; }));
  }

  function setupShell(){
    var initials=getInitials(_profile), photo=_profile.avatar_url||'';
    /* sidebar avatar */
    var sa=document.getElementById('sidebar-avatar');
    if(sa) sa.innerHTML = photo
      ? '<img src="'+esc(photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : '<span class="mp-sidebar-initials">'+esc(initials)+'</span>';
    /* topbar avatar */
    var ta=document.getElementById('topbar-avatar');
    if(ta) ta.innerHTML = photo
      ? '<img src="'+esc(photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : '<span>'+esc(initials)+'</span>';
    /* show tabs: admin-only for admins, leader-only for leaders + admins */
    if(_isAdmin)
      document.querySelectorAll('.mp-admin-only').forEach(function(el){ el.style.display=''; });
    if(_isLeader)
      document.querySelectorAll('.mp-leader-only').forEach(function(el){ el.style.display=''; });
  }

  function setupLogout(){
    var btn=document.getElementById('sidebar-logout');
    if(btn) btn.addEventListener('click', async function(e){
      e.preventDefault();
      await _sb.auth.signOut();
      window.location.href='/members/';
    });
  }

  async function loadPendingBadge(){
    var { count } = await _sb.from('profiles')
      .select('id',{count:'exact',head:true}).eq('status','pending');
    var badge=document.getElementById('admin-badge');
    if(badge){ badge.textContent=count||0; badge.style.display=count?'':'none'; }
  }

  async function loadNavSubmenus(){
    /* MCs */
    var { data:mcs } = await _sb.from('missional_communities').select('id,name').order('name');
    if(mcs&&mcs.length){
      var sub=document.getElementById('mp-nav-sub-mcs');
      if(sub){ mcs.forEach(function(mc){
        var a=document.createElement('a');
        a.href='?tab=mcs&mc_id='+encodeURIComponent(mc.id); a.className='mp-nav-subitem'; a.textContent=mc.name;
        (function(mcId){ a.addEventListener('click',function(e){ e.preventDefault(); navigateGroup('mcs',mcId); }); })(mc.id);
        sub.appendChild(a);
      }); }
    }
    /* Teams */
    var { data:teams } = await _sb.from('teams').select('id,name').order('name');
    if(teams&&teams.length){
      var sub2=document.getElementById('mp-nav-sub-teams');
      if(sub2){ teams.forEach(function(t){
        var a=document.createElement('a');
        a.href='?tab=teams&team_id='+encodeURIComponent(t.id); a.className='mp-nav-subitem'; a.textContent=t.name;
        (function(tId){ a.addEventListener('click',function(e){ e.preventDefault(); navigateGroup('teams',tId); }); })(t.id);
        sub2.appendChild(a);
      }); }
    }
  }

  /* ── routing ─────────────────────────────────────────────── */
  function navigate(tab, replace){
    var url=new URL(window.location.href);
    url.searchParams.set('tab',tab);
    url.searchParams.delete('team_id');
    url.searchParams.delete('mc_id');
    url.searchParams.delete('team_edit');
    url.searchParams.delete('mc_edit');
    if(replace) window.history.replaceState({tab},'',url.toString());
    else         window.history.pushState({tab},'',url.toString());
    renderTab(tab);
  }

  function navigateGroup(tab, id){
    var url=new URL(window.location.href);
    url.searchParams.set('tab',tab);
    url.searchParams.delete('team_id');
    url.searchParams.delete('mc_id');
    url.searchParams.delete('team_edit');
    url.searchParams.delete('mc_edit');
    if(id) url.searchParams.set(tab==='teams'?'team_id':'mc_id', id);
    window.history.pushState({tab:tab},'',url.toString());
    renderTab(tab);
  }

  function renderTab(tab){
    updateNavActive(tab);
    var title=document.getElementById('mp-topbar-title');
    if(title) title.textContent=TAB_LABELS[tab]||tab;
    showLoading();

    /* check if sub-module registered a renderer */
    var key='render_'+tab;
    if(window.mpDashboard && typeof window.mpDashboard[key]==='function'){
      Promise.resolve(window.mpDashboard[key]()).catch(function(err){
        setContent('<p class="mp-empty">Error loading '+esc(TAB_LABELS[tab]||tab)+': '+esc(err&&err.message||String(err))+'</p>');
        console.error('Tab render error ('+tab+'):', err);
      });
      return;
    }
    /* built-in renderers */
    switch(tab){
      case 'welcome': renderWelcomeTab(); break;
      case 'profile': renderProfileTab(); break;
      default:
        /* Sub-module not yet registered — retry once after a short delay */
        setTimeout(function(){
          if(window.mpDashboard && typeof window.mpDashboard[key]==='function'){
            Promise.resolve(window.mpDashboard[key]()).catch(function(err){
              setContent('<p class="mp-empty">Error loading '+esc(TAB_LABELS[tab]||tab)+': '+esc(err&&err.message||String(err))+'</p>');
              console.error('Tab render error ('+tab+'):', err);
            });
          } else {
            setContent('<p class="mp-empty">Could not load the '+esc(TAB_LABELS[tab]||tab)+' tab.<br><small>Check the browser console — /js/dashboard-tabs.js may have a loading error.</small></p>');
            console.error('Tab module not registered: '+key+'. Ensure /js/dashboard-tabs.js loads without errors (check Network/Console tabs in DevTools).');
          }
        }, 400);
    }
  }

  function updateNavActive(tab){
    document.querySelectorAll('[data-tab]').forEach(function(el){
      el.classList.toggle('mp-nav-item--active', el.dataset.tab===tab);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     TAB: WELCOME
     ══════════════════════════════════════════════════════════════ */
  async function renderWelcomeTab(){
    var hour=(new Date()).getHours();
    var greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
    var firstName=_profile.first_name||(_profile.full_name||'').split(' ')[0]||'friend';
    var initials=getInitials(_profile), photo=_profile.avatar_url||'';

    /* parallel data fetches */
    var todayStr    = new Date().toISOString().split('T')[0];
    var sevenDayStr = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    /* also fetch user's team memberships for message filtering */
    var [msgsRes, treeRes, pendRes, rosterRes, evtAssignRes, myTeamsRes, myChildrenRes, notifsRes] = await Promise.all([
      _sb.from('admin_messages').select('*').order('published_at',{ascending:false}).limit(40),
      _sb.from('file_tree').select('tree').limit(1).maybeSingle(),
      _isAdmin ? _sb.from('profiles').select('*').eq('status','pending').order('created_at') : Promise.resolve({data:[]}),
      _sb.from('schedule_rosters').select('date,title,type,slots').gte('date',todayStr).order('date').limit(52),
      _sb.from('events').select('id,title,event_date,event_time,slots').gte('event_date',todayStr).order('event_date').limit(52),
      _sb.from('team_members').select('team_id').eq('member_id',_user.id),
      /* fetch children for both parents in the family so both get notified */
      _profile.spouse_id
        ? _sb.from('children').select('id,name,profile_id').in('profile_id', [_user.id, _profile.spouse_id]).order('name')
        : _sb.from('children').select('id,name,profile_id').eq('profile_id', _user.id).order('name'),
      /* personal notifications (age-transition policy, etc.) */
      _sb.from('member_notifications')
        .select('id,type,title,body,child_id,created_at,read_at,dismissed_at')
        .eq('profile_id',_user.id)
        .is('dismissed_at',null)
        .order('created_at',{ascending:false})
        .limit(10)
    ]);
    var myTeamIds = (myTeamsRes.data||[]).map(function(r){ return r.team_id; });
    var activeNotifs = notifsRes.data || [];
    /* mark newly fetched notifications as read (fire-and-forget) */
    var unreadIds = activeNotifs.filter(function(n){ return !n.read_at; }).map(function(n){ return n.id; });
    if(unreadIds.length){
      _sb.from('member_notifications').update({read_at:new Date().toISOString()}).in('id',unreadIds);
    }
    /* filter messages: show 'all', plus mc/team messages that target this user */
    var allMsgs = msgsRes.data || [];
    var msgs = allMsgs.filter(function(m){
      if(!m.target_audience || m.target_audience === 'all' || m.target_audience === 'members') return true;
      if(m.target_audience === 'leaders') return _isLeader;
      if(m.target_audience === 'mc' && m.target_mc_id) return m.target_mc_id === _profile.preferred_community;
      if(m.target_audience === 'team' && m.target_team_id) return myTeamIds.indexOf(m.target_team_id) !== -1;
      /* legacy: target_team_id without target_audience */
      if(m.target_team_id && !m.target_audience) return myTeamIds.indexOf(m.target_team_id) !== -1;
      return true;
    }).slice(0,20);
    var pending = pendRes.data  || [];
    var recentFiles = [];
    if(treeRes.data&&treeRes.data.tree){
      var allF=[]; collectFiles(treeRes.data.tree, allF);
      allF.sort(function(a,b){return (b.uploaded_at||b.added_at||0)-(a.uploaded_at||a.added_at||0);});
      recentFiles = allF.slice(0,5);
    }

    /* find upcoming serving: rosters + calendar event slots */
    var upcomingServing = [];
    var urgentAssign   = [];  /* event assignments within 7 days → notification */
    (rosterRes.data || []).forEach(function(r){
      var myRoles = (r.slots || []).filter(function(s){
        return (s.assignee_type==='member' && s.assignee_id===_user.id) ||
               (s.assignee_type==='couple' && (s.assignee_id===_user.id || s.assignee_id_b===_user.id));
      }).map(function(s){ return s.role||''; }).filter(Boolean);
      if(myRoles.length) upcomingServing.push({date:r.date, title:r.title||'Sunday Service', roles:myRoles});
    });
    var myChildren   = myChildrenRes.data || [];
    var myChildIdSet = {};
    myChildren.forEach(function(c){ myChildIdSet[c.id] = c.name; });

    var urgentChildAssign = [];   /* events where the user's children are serving this week */
    (evtAssignRes.data || []).forEach(function(ev){
      var myRoles = (ev.slots || []).filter(function(s){
        return (s.assignee_type==='member'  && s.assignee_id===_user.id) ||
               (s.assignee_type==='couple'  && (s.assignee_id===_user.id || s.assignee_id_b===_user.id));
      }).map(function(s){ return s.role||''; }).filter(Boolean);
      /* check if any of the user's children are in this event */
      var myKidSlots = (ev.slots || []).filter(function(s){
        return s.assignee_type==='child' && myChildIdSet[s.assignee_id];
      });
      if(myRoles.length){
        upcomingServing.push({date:ev.event_date, title:ev.title, roles:myRoles});
        if(ev.event_date <= sevenDayStr) urgentAssign.push({
          date:ev.event_date, title:ev.title, time:ev.event_time||'', roles:myRoles,
          allSlots: ev.slots || []
        });
      }
      if(myKidSlots.length && ev.event_date <= sevenDayStr){
        urgentChildAssign.push({
          date: ev.event_date, title: ev.title, time: ev.event_time||'',
          children: myKidSlots.map(function(s){
            return { name: s.child_name || myChildIdSet[s.assignee_id] || '', role: s.role||'' };
          })
        });
      }
    });
    upcomingServing.sort(function(a,b){ return a.date.localeCompare(b.date); });

    var html='';
    html += '<div class="mp-welcome-header">';
    html += renderAvatar(initials, photo, 'mp-avatar--lg');
    html += '<h2 class="mp-welcome-name">'+esc(greeting)+', '+esc(firstName)+'!</h2>';
    html += '</div>';

    /* ── profile completion reminder (shown once until dismissed) ── */
    if(!_profile.profile_reminder_dismissed){
      if(!document.getElementById('mp-profile-reminder-css')){
        var prcss=document.createElement('style'); prcss.id='mp-profile-reminder-css';
        prcss.textContent=[
          '.mp-profile-reminder{background:#f0f7ff;border:1px solid #3b82f6;border-radius:8px;overflow:hidden;margin-bottom:20px;}',
          '.mp-profile-reminder-hd{background:#112E53;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:9px;font-weight:700;font-size:0.93rem;}',
          '.mp-profile-reminder-body{padding:16px;}',
          '.mp-profile-reminder-intro{margin:0 0 12px;font-size:0.9rem;color:#1e3a5f;line-height:1.5;}',
          '.mp-profile-reminder-questions{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:8px;}',
          '.mp-profile-reminder-question{background:#fff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;font-size:0.87rem;color:#1e293b;line-height:1.5;}',
          '.mp-profile-reminder-question strong{color:#112E53;display:block;margin-bottom:2px;}',
          '.mp-profile-reminder-actions{display:flex;gap:10px;flex-wrap:wrap;}'
        ].join('');
        document.head.appendChild(prcss);
      }
      var personSvg='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      html+='<div class="mp-profile-reminder" id="mp-profile-reminder">';
      html+='<div class="mp-profile-reminder-hd">'+personSvg+'Finish Setting Up Your Profile</div>';
      html+='<div class="mp-profile-reminder-body">';
      html+='<p class="mp-profile-reminder-intro">Welcome! Your account is all set. Here are a couple of things you can add to make your profile complete:</p>';
      html+='<ul class="mp-profile-reminder-questions">';
      html+='<li class="mp-profile-reminder-question"><strong>Do you have a spouse who is also a member?</strong>You can link your profiles together so your connection shows in the directory and your family info stays in sync.</li>';
      html+='<li class="mp-profile-reminder-question"><strong>Do you have children you\'d like to add?</strong>You can add your children\'s names, birthdays, and genders to your profile.</li>';
      html+='</ul>';
      html+='<div class="mp-profile-reminder-actions">';
      html+='<button class="mp-btn mp-btn--primary" onclick="mpDismissProfileReminder(true)">Set Up Now</button>';
      html+='<button class="mp-btn mp-btn--secondary" onclick="mpDismissProfileReminder(false)">Not Right Now</button>';
      html+='</div></div></div>';
    }

    /* ── personal notifications (age-transition policy, etc.) ── */
    if(activeNotifs.length){
      if(!document.getElementById('mp-member-notif-css')){
        var nc=document.createElement('style'); nc.id='mp-member-notif-css';
        nc.textContent=[
          '.mp-member-notifs{margin-bottom:20px;}',
          '.mp-member-notif{background:#fff8f0;border:1px solid #D5393B;border-radius:8px;overflow:hidden;margin-bottom:12px;}',
          '.mp-member-notif-hd{background:#D5393B;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
          '.mp-member-notif-hd-title{font-weight:700;font-size:0.9rem;flex:1;}',
          '.mp-member-notif-dismiss{background:none;border:none;color:rgba(255,255,255,0.85);font-size:0.8rem;cursor:pointer;padding:3px 8px;border-radius:4px;line-height:1.2;flex-shrink:0;}',
          '.mp-member-notif-dismiss:hover{background:rgba(255,255,255,0.2);}',
          '.mp-member-notif-body{padding:12px 14px;font-size:0.87rem;color:#30343B;line-height:1.6;}',
          '.mp-member-notif-date{font-size:0.77rem;color:#999;padding:0 14px 10px;}'
        ].join('');
        document.head.appendChild(nc);
      }
      html+='<div class="mp-member-notifs">';
      activeNotifs.forEach(function(n){
        var d=new Date(n.created_at);
        var dl=isNaN(d.getTime())?'':d.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
        html+='<div class="mp-member-notif" id="mpnotif-'+esc(n.id)+'">';
        html+='<div class="mp-member-notif-hd">';
        html+='<span class="mp-member-notif-hd-title">'+esc(n.title)+'</span>';
        html+='<button class="mp-member-notif-dismiss" onclick="mpDismissNotif(\''+esc(n.id)+'\')">Dismiss &times;</button>';
        html+='</div>';
        html+='<div class="mp-member-notif-body">'+sanitizeBody(n.body)+'</div>';
        if(dl) html+='<div class="mp-member-notif-date">'+esc(dl)+'</div>';
        html+='</div>';
      });
      html+='</div>';
    }

    /* flash messages */
    var qs=new URLSearchParams(window.location.search);
    if(qs.get('approved')==='1') html+=alertHtml('Account approved — member notified by email.','success');
    if(qs.get('rejected')==='1') html+=alertHtml('Account rejected and removed.','warning');

    /* ── upcoming event assignment notifications (within 7 days) ── */
    if(urgentAssign.length){
      if(!document.getElementById('mp-evtnotify-css')){
        var sn=document.createElement('style'); sn.id='mp-evtnotify-css';
        sn.textContent=[
          '.mp-evtnotify{background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;overflow:hidden;margin-bottom:16px;}',
          '.mp-evtnotify-hd{background:#f59e0b;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.9rem;}',
          '.mp-evtnotify-list{list-style:none;margin:0;padding:0;}',
          '.mp-evtnotify-row{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid #fde68a;}',
          '.mp-evtnotify-row:last-child{border-bottom:none;}',
          '.mp-evtnotify-date{display:inline-block;font-size:0.76rem;font-weight:700;color:#92400e;background:#fef3c7;border-radius:4px;padding:2px 7px;white-space:nowrap;flex-shrink:0;margin-top:1px;text-decoration:none;cursor:pointer;}',
          '.mp-evtnotify-date:hover{opacity:0.8;}',
          '.mp-evtnotify-info{flex:1;min-width:0;}',
          '.mp-evtnotify-title{font-size:0.87rem;font-weight:600;color:#222;}',
          '.mp-evtnotify-roles{font-size:0.8rem;color:#78350f;margin-top:1px;}'
        ].join('');
        document.head.appendChild(sn);
      }
      var bellSvg='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
      html+='<div class="mp-evtnotify">';
      html+='<div class="mp-evtnotify-hd">'+bellSvg+'Upcoming Assignments This Week</div>';
      html+='<ul class="mp-evtnotify-list">';
      urgentAssign.forEach(function(ev){
        var d=new Date(ev.date+'T12:00:00');
        var dl=isNaN(d.getTime())?ev.date:d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
        html+='<li class="mp-evtnotify-row">';
        html+='<a class="mp-evtnotify-date" href="#" onclick="mpNavToCalDate(\''+esc(ev.date)+'\');return false;">'+esc(dl)+'</a>';
        html+='<div class="mp-evtnotify-info"><div class="mp-evtnotify-title">'+esc(ev.title)+(ev.time?' &mdash; '+esc(ev.time):'')+'</div>';
        html+='<div class="mp-evtnotify-roles">'+esc(ev.roles.join(', '))+'</div>';
        html+='</div></li>';
      });
      html+='</ul></div>';
    }

    /* ── children serving this week (parent notification) ── */
    if(urgentChildAssign.length){
      if(!document.getElementById('mp-evtnotify-css')){
        var sn2=document.createElement('style'); sn2.id='mp-evtnotify-css';
        sn2.textContent='.mp-evtnotify{background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;overflow:hidden;margin-bottom:16px;}.mp-evtnotify-hd{background:#f59e0b;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.9rem;}.mp-evtnotify-list{list-style:none;margin:0;padding:0;}.mp-evtnotify-row{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid #fde68a;}.mp-evtnotify-row:last-child{border-bottom:none;}.mp-evtnotify-date{font-size:0.76rem;font-weight:700;color:#92400e;background:#fef3c7;border-radius:4px;padding:2px 7px;white-space:nowrap;flex-shrink:0;margin-top:1px;}.mp-evtnotify-info{flex:1;min-width:0;}.mp-evtnotify-title{font-size:0.87rem;font-weight:600;color:#222;}.mp-evtnotify-roles{font-size:0.8rem;color:#78350f;margin-top:1px;}';
        document.head.appendChild(sn2);
      }
      var kidSvg='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
      html+='<div class="mp-evtnotify" style="border-color:#818cf8;">';
      html+='<div class="mp-evtnotify-hd" style="background:#4f46e5;">'+kidSvg+'Your Children Are Serving This Week</div>';
      html+='<ul class="mp-evtnotify-list">';
      urgentChildAssign.forEach(function(ev){
        var d=new Date(ev.date+'T12:00:00');
        var dl=isNaN(d.getTime())?ev.date:d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
        html+='<li class="mp-evtnotify-row" style="border-color:#e0e7ff;">';
        html+='<span class="mp-evtnotify-date" style="color:#3730a3;background:#e0e7ff;">'+esc(dl)+'</span>';
        html+='<div class="mp-evtnotify-info"><div class="mp-evtnotify-title">'+esc(ev.title)+(ev.time?' &mdash; '+esc(ev.time):'')+'</div>';
        ev.children.forEach(function(ch){
          html+='<div class="mp-evtnotify-roles" style="color:#3730a3;">'+esc(ch.name)+' &mdash; '+esc(ch.role)+'</div>';
        });
        html+='</div></li>';
      });
      html+='</ul></div>';
    }

    /* ── upcoming serving card ── */
    if(upcomingServing.length){
      if(!document.getElementById('mp-serving-css')){
        var ss=document.createElement('style'); ss.id='mp-serving-css';
        ss.textContent=[
          '.mp-serving-card{background:#fff;border-radius:8px;border:1px solid #dde3eb;box-shadow:0 2px 10px rgba(0,0,0,0.07);overflow:hidden;margin-bottom:24px;}',
          '.mp-serving-card-hd{background:#112E53;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:9px;}',
          '.mp-serving-card-hd-title{font-weight:700;font-size:0.93rem;letter-spacing:.01em;}',
          '.mp-serving-list{list-style:none;margin:0;padding:0;}',
          '.mp-serving-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #f0f4f8;transition:background .1s;}',
          '.mp-serving-row:last-child{border-bottom:none;}',
          '.mp-serving-row:hover{background:#f7f9fc;}',
          '.mp-serving-date-pill{background:#e5ecf8;color:#112E53;border-radius:4px;padding:3px 9px;font-size:0.76rem;font-weight:700;white-space:nowrap;min-width:74px;text-align:center;flex-shrink:0;}',
          '.mp-serving-date-pill--next{background:#112E53;color:#fff;}',
          '.mp-serving-info{flex:1;min-width:0;}',
          '.mp-serving-event-title{font-size:0.87rem;font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
          '.mp-serving-roles{font-size:0.81rem;color:#5C718E;margin-top:2px;}',
          '.mp-serving-card-ft{padding:9px 16px;border-top:1px solid #f0f4f8;text-align:right;}',
          '.mp-serving-card-ft a{font-size:0.82rem;color:#112E53;text-decoration:none;font-weight:600;}',
          '.mp-serving-card-ft a:hover{text-decoration:underline;}'
        ].join('');
        document.head.appendChild(ss);
      }
      var calSvg='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.85"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
      html+='<div class="mp-serving-card">';
      html+='<div class="mp-serving-card-hd">'+calSvg+'<span class="mp-serving-card-hd-title">Your Upcoming Serving</span></div>';
      html+='<ul class="mp-serving-list">';
      var displayServing = upcomingServing.slice(0,8);
      displayServing.forEach(function(ev, i){
        var d = new Date(ev.date+'T12:00:00');
        var dateLbl = isNaN(d.getTime()) ? ev.date : d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
        var isNext = (i===0);
        html+='<li class="mp-serving-row">';
        html+='<span class="mp-serving-date-pill'+(isNext?' mp-serving-date-pill--next':'')+'">';
        html+=esc(dateLbl)+'</span>';
        html+='<div class="mp-serving-info">';
        html+='<div class="mp-serving-event-title">'+esc(ev.title)+'</div>';
        html+='<div class="mp-serving-roles">'+esc(ev.roles.join(', '))+'</div>';
        html+='</div>';
        html+='</li>';
      });
      html+='</ul>';
      html+='<div class="mp-serving-card-ft">';
      if(upcomingServing.length>8) html+='<a href="#" onclick="window.mpDashboard.navigate(\'schedule\');return false;">+'+(upcomingServing.length-8)+' more &mdash; View full schedule &rarr;</a>';
      else html+='<a href="#" onclick="window.mpDashboard.navigate(\'schedule\');return false;">View full schedule &rarr;</a>';
      html+='</div>';
      html+='</div>';
    }

    /* ── pending approvals (admin) ── */
    if(_isAdmin && pending.length){
      html+='<div class="mp-pending-panel">';
      html+='<div class="mp-pending-panel-header"><span class="mp-pending-panel-title">Pending Approvals</span><span class="mp-pending-count">'+pending.length+' pending</span></div>';
      html+='<div class="mp-pending-list">';
      pending.forEach(function(pu){
        var pn=((pu.first_name||'')+(pu.last_name?' '+pu.last_name:'')).trim()||pu.full_name||pu.email;
        var pin=getInitials(pu);
        html+='<div class="mp-pending-card">';
        html+='<div class="mp-pending-card-info">'+renderAvatar(pin,pu.avatar_url,'')+'<div class="mp-pending-details">';
        html+='<div class="mp-pending-name">'+esc(pn)+'</div>';
        html+='<div class="mp-pending-meta"><span>'+esc(pu.email)+'</span>';
        if(pu.phone1) html+='<span>'+esc((pu.phone1_type||'Cell')+': '+pu.phone1)+'</span>';
        if(pu.address) html+='<span>'+esc(pu.address)+'</span>';
        if(pu.birthday) html+='<span>Birthday: '+esc(fmtDate(pu.birthday))+'</span>';
        html+='<span class="mp-pending-reg-date">Registered: '+esc(new Date(pu.created_at).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}))+'</span>';
        html+='</div></div></div>';
        html+='<div class="mp-pending-actions">';
        html+='<button class="mp-btn mp-btn--approve mp-btn--small" onclick="mpApproveUser(\''+esc(pu.id)+'\')">Approve</button>';
        html+='<button class="mp-btn mp-btn--danger mp-btn--small" onclick="mpRejectUser(\''+esc(pu.id)+'\',\''+esc(pn)+'\')">Reject</button>';
        html+='</div></div>';
      });
      html+='</div></div>';
    }

    /* ── message composer (admin + leaders) ── */
    if(_isLeader){
      html+='<details class="mp-admin-panel" id="msg-composer"><summary class="mp-admin-toggle">Post a New Message <span class="mp-admin-badge">Admin</span></summary>';
      html+='<div class="mp-admin-body"><form id="msg-form">';
      html+='<div class="mp-form-row">';
      html+='<div class="mp-form-group"><label>Title <span class="mp-required">*</span></label><input type="text" name="title" required placeholder="e.g. Important Update"></div>';
      html+='<div class="mp-form-group"><label>Date</label><input type="date" name="date" value="'+new Date().toISOString().split('T')[0]+'"></div>';
      html+='</div>';
      html+='<div class="mp-form-group"><label>Message <span class="mp-required">*</span></label>';
      html+='<div class="mp-rte-toolbar">';
      html+='<button type="button" class="mp-rte-btn" onclick="document.execCommand(\'bold\')" title="Bold"><strong>B</strong></button>';
      html+='<button type="button" class="mp-rte-btn" onclick="document.execCommand(\'italic\')" title="Italic"><em>I</em></button>';
      html+='<button type="button" class="mp-rte-btn" onclick="document.execCommand(\'underline\')" title="Underline"><u>U</u></button>';
      html+='<span class="mp-rte-sep"></span>';
      html+='<button type="button" class="mp-rte-btn" onclick="mpMsgLink()" title="Link">&#128279;</button>';
      html+='<button type="button" class="mp-rte-btn" onclick="document.execCommand(\'removeFormat\')" title="Clear">&#10006;</button>';
      html+='</div>';
      html+='<div class="mp-rte-body" id="msg-rte" contenteditable="true" data-placeholder="Write your message here..."></div>';
      html+='<textarea name="body" id="msg-hidden" style="display:none;"></textarea>';
      html+='</div>';
      html+='<div class="mp-form-row" style="margin-top:12px;">';
      html+='<div class="mp-form-group"><label>Button Label <small style="font-weight:400;color:var(--color-text-muted);">(optional)</small></label><input type="text" name="link_label" placeholder="e.g. Sign Up, Learn More"></div>';
      html+='<div class="mp-form-group"><label>Button URL <small style="font-weight:400;color:var(--color-text-muted);">(optional)</small></label><input type="url" name="link_url" placeholder="https://"></div>';
      html+='</div>';
      html+='<div class="mp-notify-section"><label class="mp-checkbox-label" style="display:flex;align-items:center;gap:8px;font-size:0.88em;cursor:pointer;">';
      html+='<input type="checkbox" id="msg-notify-cb" value="1"> Send email notification to all members</label></div>';
      html+='<div style="margin-top:16px;"><button type="submit" class="mp-btn mp-btn--primary">Post Message</button></div>';
      html+='</form></div></details>';
    }

    /* ── messages feed ── */
    html+='<section style="margin-top:24px;"><h3 class="mp-section-title">Messages</h3>';
    if(!msgs.length) html+='<p class="mp-empty">No messages yet.</p>';
    else msgs.forEach(function(m){
      /* build audience label */
      var audienceLabel = '';
      if(m.target_audience === 'mc' || (m.target_mc_id && !m.target_audience)){
        audienceLabel = '<span class="mp-msg-audience-tag mp-msg-audience-tag--mc">MC Message</span>';
      } else if(m.target_audience === 'team' || (m.target_team_id && !m.target_audience)){
        audienceLabel = '<span class="mp-msg-audience-tag mp-msg-audience-tag--team">Team Message</span>';
      } else if(!m.target_audience || m.target_audience === 'all'){
        audienceLabel = '<span class="mp-msg-audience-tag">All Members</span>';
      }
      html+='<div class="mp-message-card"><div class="mp-message-header"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+audienceLabel+'<span class="mp-message-title">'+esc(m.title)+'</span></div><span class="mp-message-date">'+esc(fmtDate(m.published_at||m.created_at))+'</span></div>';
      html+='<div class="mp-message-body">'+sanitizeBody(m.content||m.body||'')+'</div>';
      if(m.link_url) html+='<div style="margin-top:12px;"><a href="'+esc(m.link_url)+'" target="_blank" rel="noopener" class="mp-btn mp-btn--outline">'+esc(m.link_label||m.link_url)+'</a></div>';
      if(_isAdmin) html+='<div class="mp-message-admin-actions"><button class="mp-btn mp-btn--small mp-btn--outline" onclick="mpDeleteMsg(\''+esc(m.id)+'\')">Delete</button></div>';
      html+='</div>';
    });
    /* inject audience tag styles once */
    if(!document.getElementById('mp-msg-tag-css')){
      var ts=document.createElement('style'); ts.id='mp-msg-tag-css';
      ts.textContent='.mp-msg-audience-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;padding:2px 8px;border-radius:4px;background:#e5ecf8;color:#112E53;white-space:nowrap;}'
        +'.mp-msg-audience-tag--mc{background:#e8f5e9;color:#2e7d32;}'
        +'.mp-msg-audience-tag--team{background:#fff3e0;color:#e65100;}';
      document.head.appendChild(ts);
    }
    html+='</section>';

    /* ── recent files ── */
    html+='<section style="margin-top:24px;"><h3 class="mp-section-title">Recently Added Files &amp; Links</h3>';
    if(!recentFiles.length) html+='<p class="mp-empty">No files or links added yet.</p>';
    else{
      html+='<ul class="mp-recent-files">';
      recentFiles.forEach(function(f){
        var icon = f.type==='link' ? '🔗' : '📄';
        html+='<li class="mp-recent-file"><span class="mp-dl-label">'+icon+' '+esc(f.name)+'</span><div class="mp-dl-actions">';
        html+='<a href="'+esc(f.url)+'" target="_blank" rel="noopener" class="mp-btn mp-btn--small">Open</a>';
        if(f.type==='file') html+='<a href="'+esc(f.url)+'" download="'+esc(f.filename||f.name)+'" class="mp-btn mp-btn--small mp-btn--outline">Download</a>';
        html+='</div></li>';
      });
      html+='</ul>';
      html+='<a href="#" class="mp-all-files-link" onclick="window.mpDashboard.navigate(\'files\');return false;">View all files →</a>';
    }
    html+='</section>';

    setContent(html);

    /* wire message form */
    var form=document.getElementById('msg-form');
    if(form){
      var rte=document.getElementById('msg-rte'), hidden=document.getElementById('msg-hidden');
      if(rte&&hidden) rte.addEventListener('input',function(){ hidden.value=rte.innerHTML; });
      form.addEventListener('submit', async function(e){
        e.preventDefault();
        if(rte&&hidden) hidden.value=rte.innerHTML;
        var title=form.querySelector('[name=title]').value.trim();
        var body=form.querySelector('[name=body]').value.trim();
        var date=form.querySelector('[name=date]').value||new Date().toISOString().split('T')[0];
        var link_url=form.querySelector('[name=link_url]').value.trim();
        var link_label=form.querySelector('[name=link_label]').value.trim();
        if(!title||!body){ alert('Title and message are required.'); return; }
        var insertPayload={author_id:_user.id, title, content:body, type:'announcement',
          target_audience:'all', published_at:new Date(date+'T12:00:00').toISOString()};
        if(link_url) insertPayload.link_url=link_url;
        if(link_label) insertPayload.link_label=link_label;
        var { error } = await _sb.from('admin_messages').insert(insertPayload);
        if(error){ alert('Error: '+error.message); return; }
        if(document.getElementById('msg-notify-cb')&&document.getElementById('msg-notify-cb').checked)
          callEdge('send-email',{action:'message_notification',title,body,date});
        renderWelcomeTab();
      });
    }
  }

  window.mpApproveUser = async function(uid){
    if(!_isAdmin) return;
    var { error }=await _sb.from('profiles').update({
      status:'approved',approved_at:new Date().toISOString(),approved_by:_user.id
    }).eq('id',uid);
    if(error){ alert('Error: '+error.message); return; }
    callEdge('send-email',{action:'account_approved',user_id:uid});
    loadPendingBadge();
    renderWelcomeTab();
  };

  window.mpRejectUser = async function(uid, name){
    if(!_isAdmin||!confirm('Permanently delete the account for '+name+'?')) return;
    await _sb.from('profiles').delete().eq('id',uid);
    loadPendingBadge();
    renderWelcomeTab();
  };

  window.mpDeleteMsg = async function(id){
    if(!_isAdmin||!confirm('Delete this message?')) return;
    await _sb.from('admin_messages').delete().eq('id',id);
    renderWelcomeTab();
  };

  window.mpDismissNotif = async function(notifId){
    await _sb.from('member_notifications')
      .update({dismissed_at:new Date().toISOString()})
      .eq('id',notifId)
      .eq('profile_id',_user.id);
    var el=document.getElementById('mpnotif-'+notifId);
    if(el){
      el.style.transition='opacity 0.3s';
      el.style.opacity='0';
      setTimeout(function(){ el.remove(); },300);
    }
  };

  window.mpMsgLink = function(){
    var body=document.getElementById('msg-rte'); if(!body) return;
    var sel=window.getSelection(), saved=sel&&sel.rangeCount?sel.getRangeAt(0).cloneRange():null;
    var url=prompt('Enter URL:','https://'); if(!url||url==='https://') return;
    body.focus();
    if(saved){var s=window.getSelection();s.removeAllRanges();s.addRange(saved);}
    document.execCommand('createLink',false,url);
    body.querySelectorAll('a').forEach(function(a){if(!a.target){a.target='_blank';a.rel='noopener';}});
    var h=document.getElementById('msg-hidden'); if(h) h.value=body.innerHTML;
  };

  /* ══════════════════════════════════════════════════════════════
     TAB: MY PROFILE
     ══════════════════════════════════════════════════════════════ */
  async function renderProfileTab(){
    var qs=new URLSearchParams(window.location.search);
    var editMode=qs.get('edit')==='1';

    /* find effective spouse ID — own spouse_id OR reverse lookup (other person linked to me) */
    var effectiveSpouseId = _profile.spouse_id || null;
    if(!effectiveSpouseId){
      var { data:revLink } = await _sb.from('profiles').select('id').eq('spouse_id',_user.id).maybeSingle();
      if(revLink) effectiveSpouseId = revLink.id;
    }

    /* parallel fetches — also pull spouse's children so both parents see the full list */
    var [childRes, teamRes, spouseRes, mcRes, spouseChildRes] = await Promise.all([
      _sb.from('children').select('*').eq('profile_id',_user.id).order('id'),
      _sb.from('team_members').select('team_id, teams(id,name)').eq('member_id',_user.id),
      effectiveSpouseId
        ? _sb.from('profiles').select('id,first_name,last_name,full_name,email,phone1,phone1_type,avatar_url').eq('id',effectiveSpouseId).maybeSingle()
        : Promise.resolve({data:null}),
      _sb.from('mc_members').select('missional_communities(id,name)').eq('profile_id',_user.id),
      effectiveSpouseId
        ? _sb.from('children').select('*').eq('profile_id',effectiveSpouseId).order('id')
        : Promise.resolve({data:[]})
    ]);
    /* merge own + spouse's children, deduplicated by name.
       With mirroring both profiles have identical rows, but we still deduplicate
       in case a save hasn't propagated yet or one side was edited independently. */
    var _ownChildren    = childRes.data||[];
    var _spouseChildren = spouseChildRes.data||[];
    var _seenNames={};
    var children=[];
    /* prefer own children first so the canonical list comes from the current user */
    _ownChildren.concat(_spouseChildren).forEach(function(c){
      var key=(c.name||'').toLowerCase().trim();
      if(key&&!_seenNames[key]){ _seenNames[key]=true; children.push(c); }
    });
    var myTeams  = (teamRes.data||[]).map(function(r){return r.teams;}).filter(Boolean);
    var spouse   = spouseRes.data||null;
    var myMCs    = (mcRes.data||[]).map(function(r){return r.missional_communities;}).filter(Boolean);

    var p=_profile, initials=getInitials(p), photo=p.avatar_url||'';

    if(!editMode){
      /* ── VIEW MODE ── */
      var pn=((p.first_name||'')+(p.last_name?' '+p.last_name:'')).trim()||p.full_name||p.email;
      var html='<h2 class="mp-tab-title">My Profile</h2><div class="mp-profile-view">';
      html+='<div class="mp-profile-header">';
      html+=renderAvatar(initials,photo,'mp-avatar--lg');
      html+='<div class="mp-profile-header-info"><div class="mp-profile-fullname">'+esc(pn)+'</div><div class="mp-profile-email-sub">'+esc(p.email)+'</div></div>';
      html+='<a href="#" onclick="mpProfileEdit();return false;" class="mp-btn mp-btn--outline mp-btn--small" style="margin-left:auto;">Edit Profile</a>';
      html+='</div>';
      html+='<dl class="mp-profile-dl mp-profile-dl--compact">';
      html+=dlRow('Email',esc(p.email));
      if(p.phone1) html+=dlRow(esc(p.phone1_type||'Cell')+' Phone',esc(p.phone1));
      if(p.phone2) html+=dlRow(esc(p.phone2_type||'Home')+' Phone',esc(p.phone2));
      if(p.addr_street) html+=dlRow('Address',esc(p.addr_street)+'<br>'+esc([p.addr_city,p.addr_province,p.addr_postal].filter(Boolean).join(', '))+(p.addr_country?'<br>'+esc(p.addr_country):''));
      if(p.birthday)    html+=dlRow('Birthday',esc(fmtDate(p.birthday)));
      if(p.gender)      html+=dlRow('Gender',p.gender==='male'?'Male':'Female');
      if(p.bio)         html+=dlRow('About',esc(p.bio).replace(/\n/g,'<br>'));
      if(spouse){
        var sn=((spouse.first_name||'')+(spouse.last_name?' '+spouse.last_name:'')).trim()||spouse.full_name||'';
        html+=dlRow('Spouse','<div class="mp-spouse-profile-card">'+renderAvatar(getInitials(spouse),spouse.avatar_url,'')+'<div class="mp-spouse-profile-info"><strong>'+esc(sn)+'</strong>'+(spouse.email?'<span class="mp-spouse-profile-email">'+esc(spouse.email)+'</span>':'')+(spouse.phone1?'<span class="mp-spouse-profile-phone">'+esc((spouse.phone1_type||'Cell')+': '+spouse.phone1)+'</span>':'')+'</div></div>');
        if(p.anniversary) html+=dlRow('Anniversary',esc(fmtDate(p.anniversary)));
      } else {
        if(p.spouse_name_text) html+=dlRow('Spouse',esc(p.spouse_name_text));
        if(p.anniversary)      html+=dlRow('Anniversary',esc(fmtDate(p.anniversary)));
      }
      if(children.length){
        html+=dlRow('Children',children.map(function(c){
          return esc(c.name)+' ('+(c.gender==='girl'?'Girl':'Boy')+')'+(c.birthday?' &mdash; '+esc(fmtDate(c.birthday)):'');
        }).join('<br>'));
        html+=dlRow('Child Reminders',
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;">'
          +'<input type="checkbox"'+(p.child_notif_optout?'':' checked')
          +' onchange="mpSaveChildOptout(!this.checked)"> Receive serving reminders for my children</label>');
      }
      if(myMCs.length){
        html+=dlRow('Missional Community',myMCs.map(function(mc){
          return '<a href="#" class="mp-profile-team-link" onclick="window.mpDashboard.navigateMC(\''+esc(mc.id)+'\');return false;">'+esc(mc.name)+'</a>';
        }).join(', '));
      }
      if(myTeams.length){
        html+=dlRow('Teams',myTeams.map(function(t){
          return '<a href="#" class="mp-profile-team-link" onclick="window.mpDashboard.navigateTeam(\''+esc(t.id)+'\');return false;">'+esc(t.name)+'</a>';
        }).join(', '));
      }
      html+='</dl>';
      html+='<a href="#" onclick="mpProfileEdit();return false;" class="mp-btn mp-btn--secondary">Edit My Profile</a>';
      html+='</div>';
      setContent(html);

    } else {
      /* ── EDIT MODE ── */
      var result=window._profileResult||null; window._profileResult=null;

      /* eligible spouses (for linking) — only when not already linked either direction */
      var eligible=[];
      if(!effectiveSpouseId){
        var { data:allM }=await _sb.from('profiles').select('id,first_name,last_name,full_name').eq('status','approved').is('spouse_id',null).neq('id',_user.id).order('last_name');
        eligible=allM||[];
      }

      var html='<h2 class="mp-tab-title">Edit My Profile</h2>';
      if(result&&result.errors&&result.errors.length) html+=alertHtml(result.errors.map(esc).join('<br>'),'error');
      if(result&&result.success) html+=alertHtml('Profile updated successfully.','success');

      html+='<form id="profile-form" class="mp-form">';

      /* photo */
      html+='<div class="mp-form-group"><label>Profile Photo</label><div class="mp-photo-upload-wrap">';
      html+='<div class="mp-photo-preview" id="pp-preview">'+(photo?'<img src="'+esc(photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">':'<span class="mp-photo-placeholder-initials">'+esc(initials)+'</span>')+'</div>';
      html+='<div class="mp-photo-upload-controls"><label class="mp-btn mp-btn--secondary mp-btn--small" for="pp-file" style="cursor:pointer;">'+(photo?'Replace Photo':'Upload Photo')+'</label>';
      html+='<input type="file" id="pp-file" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;" onchange="mpPrvPhoto(this,\'pp-preview\')"><span class="mp-hint">JPG, PNG or WebP. Max 10MB.</span></div>';
      html+='</div></div>';

      /* email / phones */
      html+='<div class="mp-form-group"><label>Email <span class="mp-required">*</span></label><input type="email" name="email" value="'+esc(p.email||'')+'" required></div>';
      html+='<div class="mp-form-group"><label>Primary Phone <span class="mp-required">*</span></label><div class="mp-phone-wrap">'+phoneSelect('phone1_type',p.phone1_type||'Cell')+'<input type="tel" name="phone1" value="'+esc(p.phone1||'')+'" required class="mp-phone-input" maxlength="12" placeholder="204-555-0100" oninput="this.value=mpFmtPh(this.value)"></div></div>';
      html+='<div class="mp-form-group"><label>Second Phone <span class="mp-optional">(Optional)</span></label><div class="mp-phone-wrap">'+phoneSelect('phone2_type',p.phone2_type||'Home')+'<input type="tel" name="phone2" value="'+esc(p.phone2||'')+'" class="mp-phone-input" maxlength="12" oninput="this.value=mpFmtPh(this.value)"></div></div>';

      /* address */
      html+='<div class="mp-form-group"><label>Street Address <span class="mp-required">*</span></label><input type="text" name="addr_street" value="'+esc(p.addr_street||'')+'" required></div>';
      html+='<div class="mp-form-row"><div class="mp-form-group"><label>City <span class="mp-required">*</span></label><input type="text" name="addr_city" value="'+esc(p.addr_city||'Winnipeg')+'" required></div>';
      html+='<div class="mp-form-group"><label>Province <span class="mp-required">*</span></label>'+provinceSelect('addr_province',p.addr_province||'MB')+'</div></div>';
      html+='<div class="mp-form-row"><div class="mp-form-group"><label>Postal Code <span class="mp-required">*</span></label><input type="text" name="addr_postal" value="'+esc(p.addr_postal||'')+'" required maxlength="7"></div><div class="mp-form-group"><label>Country</label><input type="text" name="addr_country" value="'+esc(p.addr_country||'Canada')+'"></div></div>';

      /* personal */
      html+='<div class="mp-form-row"><div class="mp-form-group"><label>Birthday <span class="mp-required">*</span></label><input type="date" name="birthday" value="'+esc(p.birthday||'')+'" required></div><div class="mp-form-group"><label>Anniversary <span class="mp-optional">(Optional)</span></label><input type="date" name="anniversary" value="'+esc(p.anniversary||'')+'"></div></div>';
      html+='<div class="mp-form-group"><label>Gender</label><select name="gender"><option value="">-- Select --</option><option value="male"'+(p.gender==='male'?' selected':'')+'>Male</option><option value="female"'+(p.gender==='female'?' selected':'')+'>Female</option></select></div>';
      html+='<div class="mp-form-group"><label>About You <span class="mp-optional">(Optional)</span></label><textarea name="bio" rows="4">'+esc(p.bio||'')+'</textarea></div>';

      /* family */
      html+='<div class="mp-section-divider">Family</div>';
      if(effectiveSpouseId&&spouse){
        var sn2=((spouse.first_name||'')+(spouse.last_name?' '+spouse.last_name:'')).trim()||spouse.full_name||'';
        html+='<div class="mp-family-linked-notice"><span>Linked to <strong>'+esc(sn2)+'</strong></span><span class="mp-hint" style="display:block;margin-top:4px;">To unlink, contact an administrator.</span></div>';
        html+='<div class="mp-form-group"><label>Wedding Anniversary <span class="mp-required">*</span></label><input type="date" name="anniversary" value="'+esc(p.anniversary||'')+'" required></div>';
      } else {
        html+='<div class="mp-spouse-member-check"><label class="mp-spouse-member-label"><input type="checkbox" name="spouse_is_member" id="sp-mem-cb" value="1"'+(p.spouse_is_member?' checked':'')+' onchange="mpToggleSpousePanel(this.checked)"> My spouse is a member</label></div>';
        /* non-member panel */
        html+='<div id="sp-nonmem"'+(p.spouse_is_member?' style="display:none;"':'')+'>';
        html+='<div class="mp-form-group"><label>Spouse\'s Name <span class="mp-optional">(Optional)</span></label><input type="text" name="spouse_name_text" value="'+esc(p.spouse_name_text||'')+'" placeholder="e.g. Jane Smith"></div>';
        html+='<div class="mp-spouse-invite-box"><p class="mp-spouse-invite-intro">If your spouse doesn\'t have an account, enter their email to send an invitation.</p>';
        html+='<div class="mp-form-group" style="margin-bottom:0;"><label>Spouse\'s Email <span class="mp-optional">(to send invitation)</span></label><input type="email" name="spouse_invite_email" placeholder="spouse@example.com"><span class="mp-hint">Leave blank to skip.</span></div></div>';
        html+='</div>';
        /* member panel */
        html+='<div id="sp-mem"'+(p.spouse_is_member?'':' style="display:none;"')+'>';
        html+='<div class="mp-form-group"><label>Find Spouse\'s Profile</label><div class="mp-spouse-picker">';
        html+='<input type="text" class="mp-spouse-filter-input" placeholder="Type to filter…" oninput="mpFilterSpouseList(this.value)" autocomplete="off">';
        html+='<select id="sp-select" class="mp-spouse-select-list" size="6" onchange="mpSpouseChosen(this)">';
        eligible.forEach(function(m){
          var mn=((m.first_name||'')+(m.last_name?' '+m.last_name:'')).trim()||m.full_name||'';
          html+='<option value="'+esc(m.id)+'" data-name="'+esc(mn)+'" data-search="'+esc(mn.toLowerCase())+'">'+esc(mn)+'</option>';
        });
        html+='</select>';
        html+='<input type="hidden" name="spouse_link_id" id="sp-link-id" value="">';
        html+='<div class="mp-spouse-picker-footer"><span class="mp-spouse-selected-label" id="sp-selected-lbl">Select a name to link</span><button type="submit" class="mp-btn mp-btn--primary mp-btn--small" id="sp-link-btn" disabled>Link Profiles</button></div>';
        html+='</div></div></div>';
        html+='<div class="mp-form-group"><label>Anniversary <span class="mp-optional">(Optional)</span></label><input type="date" name="anniversary" value="'+esc(p.anniversary||'')+'"></div>';
      }

      /* children */
      var kidsRows=children.concat([{name:'',gender:'boy',birthday:''}]);
      html+='<div class="mp-form-group"><label>Children <span class="mp-optional">(Optional)</span></label><div id="children-list">';
      kidsRows.forEach(function(ch,i){
        html+='<div class="mp-child-row" data-index="'+i+'">';
        html+='<select name="ch['+i+'][gender]" class="mp-child-gender"><option value="boy"'+(ch.gender!=='girl'?' selected':'')+'>Boy</option><option value="girl"'+(ch.gender==='girl'?' selected':'')+'>Girl</option></select>';
        html+='<input type="text" name="ch['+i+'][name]" value="'+esc(ch.name||'')+'" placeholder="Child\'s name" class="mp-child-name">';
        html+='<input type="date" name="ch['+i+'][birthday]" value="'+esc(ch.birthday||'')+'" class="mp-child-birthday">';
        if(!ch.name) html+='<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpSaveChild(this)">+ Add</button>';
        else         html+='<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpAddChildRow()">+ Add Another</button>';
        html+='</div>';
      });
      html+='</div><span class="mp-hint">Fill in a child\'s details and click + Add to save.</span></div>';
      html+='<div class="mp-form-group" style="margin-top:4px;"><label class="mp-checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">';
      html+='<input type="checkbox" name="child_notif_receive" value="1"'+(p.child_notif_optout?'':' checked')+'>';
      html+=' <span>Receive serving reminders when my children are scheduled</span></label>';
      html+='<span class="mp-hint">Uncheck to stop receiving reminder emails for your children\'s slots.</span></div>';

      /* password */
      html+='<fieldset class="mp-fieldset"><legend>Change Password <span class="mp-optional">(leave blank to keep current)</span></legend>';
      html+='<div class="mp-form-row">';
      html+='<div class="mp-form-group"><label>New Password</label><div class="mp-password-wrap"><input type="password" id="pp-pw" name="new_password" autocomplete="new-password" minlength="8" oninput="mpPwStr(this)">'+
        '<button type="button" class="mp-toggle-pw" onclick="mpTglPw(\'pp-pw\',this)">'+pwEyeSvg()+'</button></div>'+
        '<div class="mp-pw-strength-wrap"><div class="mp-pw-strength-track"><div class="mp-pw-strength-bar" id="pp-pw-bar"></div></div><span class="mp-pw-strength-label" id="pp-pw-lbl"></span></div></div>';
      html+='<div class="mp-form-group"><label>Confirm</label><div class="mp-password-wrap"><input type="password" id="pp-pw2" name="confirm_password" autocomplete="new-password">'+
        '<button type="button" class="mp-toggle-pw" onclick="mpTglPw(\'pp-pw2\',this)">'+pwEyeSvg()+'</button></div></div>';
      html+='</div></fieldset>';

      html+='<input type="hidden" name="stay_edit" id="pp-stay" value="">';
      html+='<div style="display:flex;gap:12px;margin-top:8px;"><button type="submit" class="mp-btn mp-btn--primary" style="flex:1;">Save Changes</button><a href="#" onclick="mpProfileView();return false;" class="mp-btn mp-btn--secondary">Cancel</a></div>';
      html+='</form>';

      setContent(html);
      wireProfileForm(children, effectiveSpouseId);
    }
  }

  /* profile helpers exposed globally */
  window.mpSaveChildOptout = async function(optout){
    await _sb.from('profiles').update({child_notif_optout:optout}).eq('id',_user.id);
    _profile.child_notif_optout=optout;
    showToast(optout?'You will no longer receive child serving reminders.':'You will now receive child serving reminders.');
  };

  window.mpDismissProfileReminder = async function(goToProfile){
    await _sb.from('profiles').update({profile_reminder_dismissed:true}).eq('id',_user.id);
    _profile.profile_reminder_dismissed = true;
    var card = document.getElementById('mp-profile-reminder');
    if(card) card.remove();
    if(goToProfile) mpProfileEdit();
  };

  window.mpProfileEdit = function(){
    var url=new URL(window.location.href);
    url.searchParams.set('edit','1'); url.searchParams.set('tab','profile');
    window.history.pushState({},'',url.toString()); renderProfileTab();
  };
  window.mpProfileView = function(){
    var url=new URL(window.location.href);
    url.searchParams.delete('edit'); url.searchParams.set('tab','profile');
    window.history.pushState({},'',url.toString()); renderProfileTab();
  };
  window.mpToggleSpousePanel = function(isMember){
    var mem=document.getElementById('sp-mem'), non=document.getElementById('sp-nonmem');
    if(mem) mem.style.display=isMember?'':'none';
    if(non) non.style.display=isMember?'none':'';
  };
  window.mpFilterSpouseList = function(q){
    var sel=document.getElementById('sp-select'); if(!sel) return;
    q=q.toLowerCase().trim();
    for(var i=0;i<sel.options.length;i++){
      var o=sel.options[i];
      o.style.display=(!q||(o.dataset.search||'').indexOf(q)!==-1)?'':'none';
    }
    sel.selectedIndex=-1; document.getElementById('sp-link-id').value='';
    var btn=document.getElementById('sp-link-btn'); if(btn) btn.disabled=true;
  };
  window.mpSpouseChosen = function(sel){
    var o=sel.options[sel.selectedIndex]; if(!o||!o.value) return;
    document.getElementById('sp-link-id').value=o.value;
    var btn=document.getElementById('sp-link-btn'); if(btn) btn.disabled=false;
    var lbl=document.getElementById('sp-selected-lbl');
    if(lbl) lbl.textContent='"'+(o.dataset.name||o.textContent)+'" selected — click Link Profiles.';
  };
  window.mpPrvPhoto = function(inp, previewId){
    if(!inp.files||!inp.files[0]) return;
    var file=inp.files[0];
    inp.value=''; /* reset so same file can trigger change again */
    loadCropperJS(function(){
      ensureCropModal();
      var reader=new FileReader();
      reader.onload=function(e){
        var img=document.getElementById('mp-crop-img');
        img.src=e.target.result;
        document.getElementById('mp-crop-modal').style.display='flex';
        if(_cropperInstance){ _cropperInstance.destroy(); _cropperInstance=null; }
        _cropperInstance=new Cropper(img,{
          aspectRatio:1, viewMode:1, autoCropArea:0.9,
          cropBoxResizable:false, cropBoxMovable:false, dragMode:'move',
          guides:false, center:false, highlight:false, background:true,
          minContainerHeight:300
        });
        _cropCallback=function(blob){
          var el=document.getElementById(previewId);
          if(el) el.innerHTML='<img src="'+URL.createObjectURL(blob)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
          window._avatarCropBlob=blob;
          window._avatarCropOrigName=file.name;
        };
      };
      reader.readAsDataURL(file);
    });
  };

  window.mpCropApply=function(){
    if(!_cropperInstance) return;
    _cropperInstance.getCroppedCanvas({width:400,height:400,imageSmoothingQuality:'high'}).toBlob(function(blob){
      if(blob&&typeof _cropCallback==='function') _cropCallback(blob);
      document.getElementById('mp-crop-modal').style.display='none';
      if(_cropperInstance){ _cropperInstance.destroy(); _cropperInstance=null; }
      _cropCallback=null;
    },'image/jpeg',0.92);
  };

  window.mpCropCancel=function(){
    document.getElementById('mp-crop-modal').style.display='none';
    if(_cropperInstance){ _cropperInstance.destroy(); _cropperInstance=null; }
    _cropCallback=null;
  };
  window.mpFmtPh = formatPhone;
  window.mpTglPw = function(id,btn){
    var inp=document.getElementById(id); if(!inp) return;
    var show=inp.type==='password'; inp.type=show?'text':'password';
    var s=btn.querySelector('.mp-eye-show'), h=btn.querySelector('.mp-eye-hide');
    if(s) s.style.display=show?'none':''; if(h) h.style.display=show?'':'none';
  };
  window.mpPwStr = function(inp){
    var bar=document.getElementById('pp-pw-bar'), lbl=document.getElementById('pp-pw-lbl'); if(!bar) return;
    var pw=inp.value, sc=0;
    if(pw.length>=8) sc++; if(/[A-Z]/.test(pw)) sc++; if(/[0-9]/.test(pw)) sc++; if(/[^A-Za-z0-9]/.test(pw)) sc++;
    var cols=['','#e74c3c','#e67e22','#f1c40f','#27ae60'], labs=['','Weak','Fair','Good','Strong'];
    bar.style.width=(sc*25)+'%'; bar.style.background=cols[sc]||'';
    if(lbl){ lbl.textContent=labs[sc]||''; lbl.style.color=cols[sc]||''; }
  };
  window.mpSaveChild = function(btn){
    var row=btn.closest('.mp-child-row'), n=row.querySelector('.mp-child-name');
    if(!n||!n.value.trim()){ n.focus(); n.style.borderColor='#c0392b'; setTimeout(function(){n.style.borderColor='';},2000); return; }
    /* Lock the row visually — actual DB save happens on "Save Changes" */
    n.readOnly=true; n.style.background='rgba(17,46,83,0.06)'; n.style.fontWeight='600';
    var bday=row.querySelector('.mp-child-birthday');
    if(bday){ bday.readOnly=true; bday.style.background='rgba(17,46,83,0.06)'; }
    /* Swap button to Remove */
    btn.textContent='✕ Remove';
    btn.className='mp-btn mp-btn--danger mp-btn--small';
    btn.onclick=function(){ row.remove(); };
    /* Add a fresh empty row for the next child */
    window.mpAddChildRow();
  };
  window.mpAddChildRow = function(){
    var list=document.getElementById('children-list'); if(!list) return;
    var idx=list.querySelectorAll('.mp-child-row').length;
    var row=document.createElement('div'); row.className='mp-child-row'; row.dataset.index=idx;
    row.innerHTML='<select name="ch['+idx+'][gender]" class="mp-child-gender"><option value="boy">Boy</option><option value="girl">Girl</option></select>'
      +'<input type="text" name="ch['+idx+'][name]" placeholder="Child\'s name" class="mp-child-name">'
      +'<input type="date" name="ch['+idx+'][birthday]" class="mp-child-birthday">'
      +'<button type="button" class="mp-btn mp-btn--secondary mp-btn--small" onclick="mpSaveChild(this)">+ Add</button>';
    list.appendChild(row); row.querySelector('.mp-child-name').focus();
  };

  function wireProfileForm(existingChildren, effectiveSpouseId){
    var form=document.getElementById('profile-form'); if(!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      var fd=new FormData(form);
      var stayEdit=fd.get('stay_edit')==='1';
      var errors=[];

      /* gather fields */
      var updates={
        email:fd.get('email')||_profile.email,
        phone1_type:fd.get('phone1_type')||'Cell', phone1:fd.get('phone1')||'',
        phone2_type:fd.get('phone2_type')||'Home', phone2:fd.get('phone2')||'',
        addr_street:fd.get('addr_street')||'', addr_city:fd.get('addr_city')||'',
        addr_province:fd.get('addr_province')||'', addr_postal:fd.get('addr_postal')||'',
        addr_country:fd.get('addr_country')||'Canada',
        birthday:fd.get('birthday')||null, anniversary:fd.get('anniversary')||null,
        gender:fd.get('gender')||'', bio:fd.get('bio')||'',
        spouse_is_member:fd.get('spouse_is_member')==='1',
        spouse_name_text:fd.get('spouse_name_text')||'',
        child_notif_optout:fd.get('child_notif_receive')!=='1'
      };
      updates.address=[updates.addr_street,updates.addr_city,updates.addr_province,updates.addr_postal,updates.addr_country].filter(Boolean).join(', ');

      if(!updates.phone1) errors.push('Primary phone is required.');
      if(updates.phone1&&!/^\d{3}-\d{3}-\d{4}$/.test(updates.phone1)) errors.push('Phone format: 204-555-0100');
      if(!updates.addr_street) errors.push('Street address is required.');
      if(!updates.birthday) errors.push('Birthday is required.');
      var npw=fd.get('new_password')||'', cpw=fd.get('confirm_password')||'';
      if(npw&&npw.length<8) errors.push('New password must be at least 8 characters.');
      if(npw&&npw!==cpw) errors.push('Passwords do not match.');
      if(errors.length){ window._profileResult={errors}; var url=new URL(window.location.href); url.searchParams.set('edit','1'); window.history.replaceState({},'',url.toString()); renderProfileTab(); return; }

      /* spouse link — uses SECURITY DEFINER RPC to update both profiles */
      var spId=fd.get('spouse_link_id')||'';
      if(spId&&!effectiveSpouseId){
        await _sb.rpc('link_spouses',{p_user_a:_user.id, p_user_b:spId});
        updates.spouse_id=spId;
        callEdge('send-email',{action:'spouse_linked',linker_id:_user.id,spouse_id:spId});
      }
      /* spouse invite */
      var invEmail=fd.get('spouse_invite_email')||'';
      if(invEmail&&!spId&&!effectiveSpouseId)
        callEdge('send-email',{action:'spouse_invite',inviter_id:_user.id,invitee_email:invEmail});

      /* save profile */
      var { error }=await _sb.from('profiles').update(updates).eq('id',_user.id);

      /* save children — mirror to both spouses so either parent always sees
         the full list regardless of which profile originally stored the child */
      var newChildren=parseChildrenFromDOM('children-list');
      var childRows=newChildren.map(function(c){return {name:c.name,gender:c.gender,birthday:c.birthday||null};});

      /* current user */
      await _sb.from('children').delete().eq('profile_id',_user.id);
      if(childRows.length){
        var { error:childErr }=await _sb.from('children').insert(
          childRows.map(function(r){return Object.assign({profile_id:_user.id},r);}));
        if(childErr) error=error||childErr;
      }

      /* spouse mirror — delete their copy and re-write so both are in sync */
      if(effectiveSpouseId){
        await _sb.from('children').delete().eq('profile_id',effectiveSpouseId);
        if(childRows.length){
          await _sb.from('children').insert(
            childRows.map(function(r){return Object.assign({profile_id:effectiveSpouseId},r);}));
        }
      }

      /* password */
      if(npw) await _sb.auth.updateUser({password:npw});

      /* avatar — use cropped blob if available, otherwise raw file */
      var cropBlob=window._avatarCropBlob;
      if(cropBlob){
        var avatarPath=_user.id+'/'+Date.now()+'.jpg';
        var { error:upErr }=await _sb.storage.from('avatars').upload(avatarPath,cropBlob,{upsert:true,contentType:'image/jpeg'});
        if(!upErr){ var { data:ud }=_sb.storage.from('avatars').getPublicUrl(avatarPath); await _sb.from('profiles').update({avatar_url:ud.publicUrl}).eq('id',_user.id); }
        window._avatarCropBlob=null; window._avatarCropOrigName=null;
      }

      /* refresh profile */
      var { data:fresh }=await _sb.from('profiles').select('*').eq('id',_user.id).single();
      if(fresh){ _profile=fresh; setupShell(); }

      if(error){ window._profileResult={errors:[error.message]}; var url2=new URL(window.location.href); url2.searchParams.set('edit','1'); window.history.replaceState({},'',url2.toString()); renderProfileTab(); return; }

      window._profileResult={success:true};
      var url3=new URL(window.location.href);
      if(stayEdit){ url3.searchParams.set('edit','1'); } else { url3.searchParams.delete('edit'); }
      window.history.replaceState({},'',url3.toString());
      renderProfileTab();
    });
  }

  /* Read children from DOM rows rather than FormData to avoid bracket-name issues */
  function parseChildrenFromDOM(listId){
    var list=document.getElementById(listId); if(!list) return [];
    var res=[];
    list.querySelectorAll('.mp-child-row').forEach(function(row){
      var nameEl=row.querySelector('.mp-child-name');
      var genEl =row.querySelector('.mp-child-gender');
      var bdEl  =row.querySelector('.mp-child-birthday');
      var n=(nameEl&&nameEl.value||'').trim(); if(!n) return;
      res.push({
        name:n,
        gender:(genEl&&genEl.value)||'boy',
        birthday:(bdEl&&bdEl.value)||null
      });
    });
    return res;
  }

  /* legacy FormData parser kept for reference only */
  function parseChildren(fd){
    var res=[], i=0;
    while(true){
      var n=fd.get('ch['+i+'][name]'); if(n===null) break;
      n=n.trim(); if(n) res.push({name:n,gender:fd.get('ch['+i+'][gender]')||'boy',birthday:fd.get('ch['+i+'][birthday]')||null});
      i++;
    }
    return res;
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════ */
  window.mpDashboard = {
    navigate:     navigate,
    navigateTeam: function(id){ navigateGroup('teams',id); },
    navigateMC:   function(id){ navigateGroup('mcs',id); },
    init:         init,
    getSb:       function(){ return _sb; },
    getProfile:  function(){ return _profile; },
    getUser:     function(){ return _user; },
    isAdmin:     function(){ return _isAdmin; },
    isLeader:    function(){ return _isLeader; },
    getLedMCs:   function(){ return _ledMCIds; },
    getLedTeams: function(){ return _ledTeamIds; },
    /* shared utilities for sub-modules */
    esc:                esc,
    fmtDate:            fmtDate,
    getInitials:        getInitials,
    renderAvatar:       renderAvatar,
    coupleDisplayName:  coupleDisplayName,
    alertHtml:          alertHtml,
    setContent:         setContent,
    showLoading:        showLoading,
    formatPhone:        formatPhone,
    phoneSelect:        phoneSelect,
    provinceSelect:     provinceSelect,
    dlRow:              dlRow,
    pwEyeSvg:           pwEyeSvg,
    collectFiles:       collectFiles,
    callEdge:           callEdge,
    loadPendingBadge:   loadPendingBadge
  };

  /* ── boot ────────────────────────────────────────────────── */
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
