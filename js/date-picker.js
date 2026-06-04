/*!
 * mp-date-picker — custom date picker with year-jump for all <input type="date"> elements.
 * Intercepts native pickers on all platforms so mobile users can jump directly to any year.
 */
(function () {
  'use strict';

  /* ── CSS ─────────────────────────────────────────────────────────────── */
  var CSS = [
    /* overlay backdrop */
    '#mp-dp{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);',
    'display:flex;align-items:flex-end;justify-content:center;',
    'font-family:"Source Sans Pro",sans-serif;font-size:15px}',
    '@media(min-width:480px){#mp-dp{align-items:center}}',

    /* picker card */
    '#mp-dp-box{background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:380px;',
    'overflow:hidden;box-shadow:0 -4px 32px rgba(0,0,0,.2)}',
    '@media(min-width:480px){#mp-dp-box{border-radius:16px}}',

    /* header */
    '#mp-dp-hd{background:#112E53;color:#fff;padding:18px 20px 14px;user-select:none}',
    '#mp-dp-yr-btn{font-size:13px;font-weight:700;letter-spacing:.5px;opacity:.75;',
    'background:none;border:none;color:#fff;padding:3px 8px 3px 4px;cursor:pointer;',
    'border-radius:4px;display:inline-flex;align-items:center;gap:4px}',
    '#mp-dp-yr-btn:hover,#mp-dp-yr-btn:focus{opacity:1;background:rgba(255,255,255,.15);outline:none}',
    '#mp-dp-yr-arrow{font-size:9px;transition:transform .15s}',
    '#mp-dp-yr-btn.mp-dp-open #mp-dp-yr-arrow{transform:rotate(180deg)}',
    '#mp-dp-date-disp{font-size:26px;font-weight:700;margin-top:4px;letter-spacing:-.3px}',

    /* month nav */
    '#mp-dp-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 4px 4px}',
    '#mp-dp-month-lbl{font-size:15px;font-weight:700;color:#112E53}',
    '.mp-dp-nb{background:none;border:none;cursor:pointer;font-size:22px;line-height:1;',
    'padding:6px 12px;color:#112E53;border-radius:50%}',
    '.mp-dp-nb:hover{background:#eef2f8}',

    /* day grid */
    '#mp-dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:0 8px 8px}',
    '.mp-dp-dow{text-align:center;font-size:11px;font-weight:700;color:#999;padding:4px 0}',
    '.mp-dp-day{display:flex;align-items:center;justify-content:center;',
    'aspect-ratio:1;border-radius:50%;cursor:pointer;font-size:14px;',
    'border:none;background:none;padding:0;width:100%;color:#222}',
    '.mp-dp-day:hover:not(.mp-dp-e):not(.mp-dp-dis){background:#eef2f8}',
    '.mp-dp-e{pointer-events:none;visibility:hidden}',
    '.mp-dp-today{font-weight:700;color:#112E53}',
    '.mp-dp-sel{background:#f97316!important;color:#fff!important;font-weight:700!important}',
    '.mp-dp-dis{color:#ccc!important;cursor:not-allowed!important;pointer-events:none}',

    /* action buttons */
    '#mp-dp-acts{display:flex;justify-content:flex-end;gap:4px;padding:4px 14px 14px}',
    '.mp-dp-btn{background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;',
    'color:#f97316;padding:8px 14px;border-radius:8px;letter-spacing:.6px;text-transform:uppercase;',
    "font-family:inherit}",
    '.mp-dp-btn:hover{background:#fff5ef}',

    /* year grid */
    '#mp-dp-yr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;',
    'padding:12px 16px 4px;max-height:260px;overflow-y:auto}',
    '.mp-dp-yr{text-align:center;padding:10px 4px;border-radius:8px;cursor:pointer;',
    'font-size:14px;border:none;background:none;width:100%;color:#222;font-family:inherit}',
    '.mp-dp-yr:hover{background:#eef2f8}',
    '.mp-dp-yr-sel{background:#f97316!important;color:#fff!important;font-weight:700}',
    '.mp-dp-yr-cur{font-weight:700;color:#112E53}',
  ].join('');

  var MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW     = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  var DOW3    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var _s = null; // active picker state

  /* ── Open ─────────────────────────────────────────────────────────────── */
  function openPicker(input) {
    if (document.getElementById('mp-dp')) return; // already open

    injectCSS();

    var now   = new Date();
    var hasV  = !!input.value;
    var initD = hasV ? new Date(input.value + 'T12:00:00') : null;
    var maxD  = input.max ? new Date(input.max + 'T12:00:00') : null;
    var minD  = input.min ? new Date(input.min + 'T12:00:00') : null;

    /* default view: selected date → max date → today */
    var viewY = initD ? initD.getFullYear() : (maxD ? maxD.getFullYear() : now.getFullYear());
    var viewM = initD ? initD.getMonth()    : (maxD ? maxD.getMonth()    : now.getMonth());

    _s = {
      input : input,
      viewY : viewY, viewM : viewM,
      selY  : hasV ? initD.getFullYear() : null,
      selM  : hasV ? initD.getMonth()    : null,
      selD  : hasV ? initD.getDate()     : null,
      maxD  : maxD, minD  : minD,
      mode  : 'cal',
    };

    render();
  }

  /* ── CSS injection ────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('mp-dp-css')) return;
    var s = document.createElement('style');
    s.id = 'mp-dp-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  function render() {
    var old = document.getElementById('mp-dp');
    if (old) old.remove();

    var ov = document.createElement('div');
    ov.id = 'mp-dp';
    ov.innerHTML = buildHTML();
    document.body.appendChild(ov);

    /* backdrop click → cancel */
    ov.addEventListener('click', function (e) { if (e.target === ov) closePicker(false); });

    /* action buttons */
    q('#mp-dp-acts [data-a=clear]' ).addEventListener('click', function () { closePicker('clear'); });
    q('#mp-dp-acts [data-a=cancel]').addEventListener('click', function () { closePicker(false); });
    q('#mp-dp-acts [data-a=set]'   ).addEventListener('click', function () { closePicker(true); });

    /* year toggle button */
    q('#mp-dp-yr-btn').addEventListener('click', function () {
      _s.mode = _s.mode === 'year' ? 'cal' : 'year';
      render();
    });

    if (_s.mode === 'cal') {
      q('#mp-dp-prev').addEventListener('click', function () {
        _s.viewM--; if (_s.viewM < 0) { _s.viewM = 11; _s.viewY--; } render();
      });
      q('#mp-dp-next').addEventListener('click', function () {
        _s.viewM++; if (_s.viewM > 11) { _s.viewM = 0; _s.viewY++; } render();
      });
      qAll('.mp-dp-day:not(.mp-dp-e):not(.mp-dp-dis)').forEach(function (el) {
        el.addEventListener('click', function () {
          _s.selY = _s.viewY; _s.selM = _s.viewM; _s.selD = +el.dataset.d;
          render();
        });
      });
    } else {
      /* year picker: scroll selected year into view */
      qAll('.mp-dp-yr').forEach(function (el) {
        el.addEventListener('click', function () {
          _s.viewY = +el.dataset.y;
          if (_s.selY !== null) _s.selY = _s.viewY;
          _s.mode = 'cal';
          render();
        });
      });
      var focus = q('.mp-dp-yr-sel') || q('.mp-dp-yr-cur');
      if (focus) setTimeout(function () { focus.scrollIntoView({ block: 'center', behavior: 'instant' }); }, 0);
    }
  }

  /* ── HTML builders ────────────────────────────────────────────────────── */
  function buildHTML() {
    var s = _s;
    var dispDate, dispYear;

    if (s.selY !== null) {
      var tmp  = new Date(s.selY, s.selM, s.selD);
      dispDate = DOW3[tmp.getDay()] + ', ' + MONTHS[s.selM].slice(0, 3) + ' ' + s.selD;
      dispYear = s.selY;
    } else {
      dispDate = 'Select a date';
      dispYear = s.viewY;
    }

    var yearBtnCls = '#mp-dp-yr-btn' + (s.mode === 'year' ? ' class="mp-dp-open"' : '');

    return '<div id="mp-dp-box">'
      + '<div id="mp-dp-hd">'
      +   '<button id="mp-dp-yr-btn"' + (s.mode === 'year' ? ' class="mp-dp-open"' : '') + '>'
      +     dispYear
      +     '<span id="mp-dp-yr-arrow">&#9660;</span>'
      +   '</button>'
      +   '<div id="mp-dp-date-disp">' + dispDate + '</div>'
      + '</div>'
      + '<div id="mp-dp-body">' + (s.mode === 'cal' ? buildCal() : buildYears()) + '</div>'
      + '<div id="mp-dp-acts">'
      +   '<button class="mp-dp-btn" data-a="clear">Clear</button>'
      +   '<button class="mp-dp-btn" data-a="cancel">Cancel</button>'
      +   '<button class="mp-dp-btn" data-a="set">Set</button>'
      + '</div>'
      + '</div>';
  }

  function buildCal() {
    var s = _s, y = s.viewY, m = s.viewM;
    var firstDow   = new Date(y, m, 1).getDay();
    var daysInMon  = new Date(y, m + 1, 0).getDate();
    var today      = new Date();
    var tY = today.getFullYear(), tM = today.getMonth(), tD = today.getDate();

    var h = '<div id="mp-dp-nav">'
      + '<button class="mp-dp-nb" id="mp-dp-prev">&#8249;</button>'
      + '<span id="mp-dp-month-lbl">' + MONTHS[m] + ' ' + y + '</span>'
      + '<button class="mp-dp-nb" id="mp-dp-next">&#8250;</button>'
      + '</div><div id="mp-dp-grid">';

    DOW.forEach(function (d) { h += '<div class="mp-dp-dow">' + d + '</div>'; });

    for (var i = 0; i < firstDow; i++) {
      h += '<button class="mp-dp-day mp-dp-e" tabindex="-1" aria-hidden="true"></button>';
    }

    for (var d = 1; d <= daysInMon; d++) {
      var cls  = 'mp-dp-day';
      var date = new Date(y, m, d);
      if (y === tY && m === tM && d === tD) cls += ' mp-dp-today';
      if (s.selY === y && s.selM === m && s.selD === d) cls += ' mp-dp-sel';
      var dis = (s.maxD && date > s.maxD) || (s.minD && date < s.minD);
      if (dis) cls += ' mp-dp-dis';
      h += '<button class="' + cls + '" data-d="' + d + '" type="button">' + d + '</button>';
    }

    h += '</div>';
    return h;
  }

  function buildYears() {
    var s = _s;
    var curY = new Date().getFullYear();
    var maxY = s.maxD ? s.maxD.getFullYear() : curY + 10;
    var minY = s.minD ? s.minD.getFullYear() : curY - 120;

    var h = '<div id="mp-dp-yr-grid">';
    for (var yr = maxY; yr >= minY; yr--) {
      var cls = 'mp-dp-yr';
      if (s.selY === yr) {
        cls += ' mp-dp-yr-sel';
      } else if (s.viewY === yr) {
        cls += ' mp-dp-yr-cur';
      }
      h += '<button class="' + cls + '" data-y="' + yr + '" type="button">' + yr + '</button>';
    }
    h += '</div>';
    return h;
  }

  /* ── Close / commit ───────────────────────────────────────────────────── */
  function closePicker(action) {
    var ov = document.getElementById('mp-dp');
    if (ov) ov.remove();
    if (!_s) return;

    if (action === 'clear') {
      _s.input.value = '';
      _s.input.dispatchEvent(new Event('change', { bubbles: true }));
      _s.input.dispatchEvent(new Event('input',  { bubbles: true }));
    } else if (action === true && _s.selY !== null) {
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      _s.input.value = _s.selY + '-' + p(_s.selM + 1) + '-' + p(_s.selD);
      _s.input.dispatchEvent(new Event('change', { bubbles: true }));
      _s.input.dispatchEvent(new Event('input',  { bubbles: true }));
    }
    _s = null;
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function q(sel)    { return document.querySelector(sel); }
  function qAll(sel) { return Array.from(document.querySelectorAll(sel)); }

  /* ── Intercept ALL <input type="date"> in capture phase ──────────────── */
  function intercept(e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && el.type === 'date') {
      e.preventDefault();
      e.stopPropagation();
      openPicker(el);
    }
  }

  /* mousedown covers desktop; touchstart covers mobile (passive:false lets us preventDefault) */
  document.addEventListener('mousedown',  intercept, true);
  document.addEventListener('touchstart', intercept, { capture: true, passive: false });

})();
