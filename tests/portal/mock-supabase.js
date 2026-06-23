/* =============================================================================
 * Browser-side MOCK of @supabase/supabase-js v2.
 *
 * Served to the portal pages IN PLACE OF the real CDN bundle (via Puppeteer
 * request interception), so window.supabase.createClient() returns an in-memory
 * fake backed by window.__SEED__ (the shared seed dataset) and window.__AUTH_UID__.
 *
 * Supports the chainable PostgREST-style query builder for the flat queries the
 * dashboard/scheduler/teams flows use, plus auth/storage/channel/rpc stubs.
 * Writes mutate the in-memory DB and are recorded on window.__WRITES__ so the
 * test harness can assert what the UI attempted.
 * ========================================================================== */
(function () {
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function uid() { return 'gen-' + Math.random().toString(36).slice(2, 10); }

  // Foreign keys for embedded selects: currentTable -> { embeddedTable: localCol }
  var FK = {
    team_members: { profiles: 'member_id', teams: 'team_id', children: 'child_id' },
    teams: { profiles: 'leader_id' },
    schedule_rosters: {},
    missional_communities: { profiles: 'leader_id' },
  };

  function getDB() { return (window.__SEED__ && window.__SEED__.db) || window.__DB__ || {}; }

  // Parse a select string into top-level columns + embedded groups.
  function parseSelect(sel) {
    if (!sel || sel === '*') return { cols: '*', embeds: [] };
    var cols = [], embeds = [], depth = 0, buf = '';
    for (var i = 0; i < sel.length; i++) {
      var ch = sel[i];
      if (ch === '(') {
        if (depth === 0) {
          // buf so far holds "alias:fk" or "table"
          var head = buf.trim(); buf = '';
          var sub = '', d2 = 1; i++;
          for (; i < sel.length && d2 > 0; i++) { if (sel[i] === '(') d2++; else if (sel[i] === ')') { d2--; if (d2 === 0) break; } sub += sel[i]; }
          var parts = head.split(':');
          var embTable = (parts.length > 1 ? parts[0] : head).trim();
          var fkCol = parts.length > 1 ? parts[1].trim() : null;
          embeds.push({ table: embTable, fk: fkCol, select: sub });
          continue;
        }
      } else if (ch === ',' && depth === 0) {
        if (buf.trim()) cols.push(buf.trim()); buf = ''; continue;
      }
      buf += ch;
    }
    if (buf.trim()) cols.push(buf.trim());
    return { cols: cols.length ? cols : '*', embeds: embeds };
  }

  function resolveEmbeds(table, rows, embeds) {
    var db = getDB();
    embeds.forEach(function (e) {
      var localCol = e.fk || (FK[table] && FK[table][e.table]);
      var relRows = db[e.table] || [];
      rows.forEach(function (row) {
        if (localCol && row[localCol] !== undefined) {
          // forward (many-to-one): related.id === row[localCol]
          var match = relRows.filter(function (r) { return r.id === row[localCol]; });
          row[e.table] = match.length ? clone(match[0]) : null;
        } else {
          // reverse (one-to-many): related[fkBackToTable] === row.id
          var backCol = FK[e.table] && FK[e.table][table];
          row[e.table] = backCol ? clone(relRows.filter(function (r) { return r[backCol] === row.id; })) : [];
        }
      });
    });
  }

  function Query(table) {
    this.table = table; this._filters = []; this._op = 'select';
    this._sel = '*'; this._order = []; this._limit = null;
    this._payload = null; this._onConflict = null;
  }
  var Q = Query.prototype;
  Q.select = function (s) { this._sel = s || '*'; if (this._op === 'select') this._selSet = true; return this; };
  Q.eq = function (c, v) { this._filters.push(function (r) { return r[c] === v; }); return this; };
  Q.neq = function (c, v) { this._filters.push(function (r) { return r[c] !== v; }); return this; };
  Q.gt = function (c, v) { this._filters.push(function (r) { return r[c] > v; }); return this; };
  Q.gte = function (c, v) { this._filters.push(function (r) { return r[c] >= v; }); return this; };
  Q.lt = function (c, v) { this._filters.push(function (r) { return r[c] < v; }); return this; };
  Q.lte = function (c, v) { this._filters.push(function (r) { return r[c] <= v; }); return this; };
  Q.in = function (c, vals) { var s = vals || []; this._filters.push(function (r) { return s.indexOf(r[c]) !== -1; }); return this; };
  Q.is = function (c, v) { this._filters.push(function (r) { return v === null ? (r[c] === null || r[c] === undefined) : r[c] === v; }); return this; };
  Q.contains = function () { return this; };
  Q.like = function (c, v) { var rx = new RegExp('^' + String(v).replace(/%/g, '.*') + '$', 'i'); this._filters.push(function (r) { return rx.test(r[c] || ''); }); return this; };
  Q.ilike = Q.like;
  Q.or = function (expr) {
    var parts = String(expr).split(',');
    this._filters.push(function (r) {
      return parts.some(function (p) {
        var seg = p.split('.'); var col = seg[0], op = seg[1], val = seg.slice(2).join('.');
        if (op === 'is') return val === 'null' ? (r[col] == null) : (String(r[col]) === val);
        if (op === 'eq') return String(r[col]) === val;
        if (op === 'neq') return String(r[col]) !== val;
        return false;
      });
    });
    return this;
  };
  Q.order = function (c, opts) { this._order.push({ c: c, asc: !opts || opts.ascending !== false }); return this; };
  Q.limit = function (n) { this._limit = n; return this; };
  Q.range = function () { return this; };
  Q.single = function () { this._single = true; return this._run(); };
  Q.maybeSingle = function () { this._maybe = true; return this._run(); };
  Q.insert = function (p) { this._op = 'insert'; this._payload = p; return this; };
  Q.update = function (p) { this._op = 'update'; this._payload = p; return this; };
  Q.delete = function () { this._op = 'delete'; return this; };
  Q.upsert = function (p, opts) { this._op = 'upsert'; this._payload = p; this._onConflict = opts && opts.onConflict; return this; };
  Q.then = function (res, rej) { return this._run().then(res, rej); };
  Q.catch = function (rej) { return this._run().catch(rej); };

  Q._match = function (rows) { var f = this._filters; return rows.filter(function (r) { return f.every(function (fn) { return fn(r); }); }); };

  Q._run = function () {
    var self = this; var db = getDB();
    if (!db[this.table]) db[this.table] = [];
    var tbl = db[this.table];
    return new Promise(function (resolve) {
      try {
        var result;
        if (self._op === 'select') {
          var rows = clone(self._match(tbl));
          self._order.forEach(function (o) {
            rows.sort(function (a, b) {
              var av = a[o.c], bv = b[o.c];
              if (av === bv) return 0; if (av == null) return 1; if (bv == null) return -1;
              return (av < bv ? -1 : 1) * (o.asc ? 1 : -1);
            });
          });
          if (self._limit != null) rows = rows.slice(0, self._limit);
          var parsed = parseSelect(self._sel);
          if (parsed.embeds.length) resolveEmbeds(self.table, rows, parsed.embeds);
          if (self._single) return resolve(rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'No rows', code: 'PGRST116' } });
          if (self._maybe) return resolve({ data: rows[0] || null, error: null });
          return resolve({ data: rows, error: null });
        }
        if (self._op === 'insert' || self._op === 'upsert') {
          var arr = Array.isArray(self._payload) ? self._payload : [self._payload];
          var inserted = [];
          arr.forEach(function (row) {
            var r = clone(row); if (r.id === undefined) r.id = uid();
            if (self._op === 'upsert' && self._onConflict) {
              var key = self._onConflict;
              var existingIdx = tbl.findIndex(function (x) { return x[key] === r[key]; });
              if (existingIdx !== -1) { tbl[existingIdx] = Object.assign({}, tbl[existingIdx], r); inserted.push(clone(tbl[existingIdx])); return; }
            }
            tbl.push(r); inserted.push(clone(r));
          });
          record('insert', self.table, inserted);
          return resolve(makeReturn(self, inserted));
        }
        if (self._op === 'update') {
          var matched = self._match(tbl); var updated = [];
          matched.forEach(function (r) { Object.assign(r, clone(self._payload)); updated.push(clone(r)); });
          record('update', self.table, updated);
          return resolve(makeReturn(self, updated));
        }
        if (self._op === 'delete') {
          var toDel = self._match(tbl); var ids = toDel.map(function (r) { return r; });
          db[self.table] = tbl.filter(function (r) { return toDel.indexOf(r) === -1; });
          record('delete', self.table, ids);
          return resolve(makeReturn(self, ids));
        }
        resolve({ data: null, error: { message: 'Unsupported op ' + self._op } });
      } catch (e) {
        resolve({ data: null, error: { message: 'Mock error: ' + e.message } });
      }
    });
  };

  function makeReturn(q, rows) {
    if (q._single) return { data: rows[0] || null, error: null };
    if (q._maybe) return { data: rows[0] || null, error: null };
    if (q._selSet) return { data: rows, error: null };
    return { data: null, error: null };
  }
  function record(op, table, rows) {
    window.__WRITES__ = window.__WRITES__ || [];
    window.__WRITES__.push({ op: op, table: table, rows: clone(rows), at: Date.now() });
  }

  function makeClient() {
    var authUser = { id: window.__AUTH_UID__ || 'u-tim', email: 'test@example.com' };
    return {
      auth: {
        getUser: function () { return Promise.resolve({ data: { user: authUser }, error: null }); },
        getSession: function () { return Promise.resolve({ data: { session: { user: authUser } }, error: null }); },
        signInWithPassword: function () { return Promise.resolve({ data: { user: authUser, session: { user: authUser } }, error: null }); },
        signOut: function () { return Promise.resolve({ error: null }); },
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        getUserById: function () { return Promise.resolve({ data: { user: authUser }, error: null }); },
      },
      from: function (t) { return new Query(t); },
      rpc: function (name, args) {
        record('rpc', name, args || {});
        // save_children: persist children diff for a profile so the UI can re-read
        if (name === 'save_children') { return Promise.resolve({ data: null, error: null }); }
        return Promise.resolve({ data: [], error: null });
      },
      channel: function () { var c = { on: function () { return c; }, subscribe: function () { return c; }, unsubscribe: function () {} }; return c; },
      removeChannel: function () {},
      storage: { from: function () { return {
        upload: function () { return Promise.resolve({ data: { path: 'mock' }, error: null }); },
        getPublicUrl: function () { return { data: { publicUrl: '' } }; },
        remove: function () { return Promise.resolve({ data: [], error: null }); },
        list: function () { return Promise.resolve({ data: [], error: null }); },
      }; } },
    };
  }

  window.supabase = { createClient: function () { return makeClient(); } };
})();
