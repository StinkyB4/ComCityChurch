// =============================================================================
// Focused test: the Master Schedule people selector is scoped to the team.
//
// Opening a cell for a team must only offer people who are ON that team — its
// members (plus couples where BOTH spouses are on it), and the families,
// children and non-member volunteers added to it under Teams. Assigning
// someone to Worship must never list the whole church.
//
// No browser and no backend: the real js/dashboard-schedule-master.js body is
// evaluated in a vm sandbox, its module state is seeded directly, and the
// generated <select> markup is asserted.
//
// Usage:  node test-master-schedule-picker.mjs
// =============================================================================
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', 'js', 'dashboard-schedule-master.js');

/* ── load the module body with just enough of a DOM to survive the IIFE ──── */
const src = await readFile(SRC, 'utf8');
const body = src.slice(src.indexOf('{', src.indexOf('(function ()')) + 1, src.lastIndexOf('})();'));

const sandbox = {
  window: { mpDashboard: { coupleDisplayName: (a, b) => `${a.first_name} & ${b.first_name} ${a.last_name}` } },
  document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} } },
  setTimeout: () => {}, console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  '(function(){' + body +
  '\n; globalThis.__t = {' +
  '    buildTmMap: buildTmMap, buildTeamOpts: buildTeamOpts, teamRosterEmpty: teamRosterEmpty,' +
  '    seedPeople: function (s) { _teams = s.teams; _profMap = s.profMap; _childMap = s.childMap; }' +
  '  };})();',
  sandbox
);
const M = sandbox.__t;

/* ── fixtures: the seed cast, arranged so every rule has a witness ───────── */
const P = (id, first, last, extra = {}) => ({ id, first_name: first, last_name: last, full_name: `${first} ${last}`, spouse_id: null, ...extra });
const profiles = [
  P('u-brennan', 'Brennan', 'Cattani', { spouse_id: 'u-sarah' }),
  P('u-sarah',   'Sarah',   'Cattani', { spouse_id: 'u-brennan' }),
  P('u-mike',    'Mike',    'Olsen',   { spouse_id: 'u-jen' }),
  P('u-jen',     'Jen',     'Olsen',   { spouse_id: 'u-mike' }),
  P('u-grace',   'Grace',   'Lin'),
];
const children = [
  { id: 'c-noah', name: 'Noah Cattani', profile_id: 'u-brennan' },
  { id: 'c-ella', name: 'Ella Cattani', profile_id: 'u-brennan' },   // on no team
];
const teams = [
  { id: 't-worship', name: 'Worship', allow_children: false, allow_nonmembers: true  },
  { id: 't-welcome', name: 'Welcome', allow_children: false, allow_nonmembers: true  },
  { id: 't-kids',    name: 'Kids',    allow_children: true,  allow_nonmembers: false },
  { id: 't-av',      name: 'A/V',     allow_children: true,  allow_nonmembers: true  },
  { id: 't-setup',   name: 'Setup',   allow_children: false, allow_nonmembers: false }, // nobody on it
];
const profMap = {}; profiles.forEach(p => (profMap[p.id] = p));
const childMap = {}; children.forEach(c => (childMap[c.id] = c));
M.seedPeople({ teams, profMap, childMap });

const tm = (team_id, extra) => ({ team_id, member_id: null, member_type: 'member', child_id: null, nonmember_name: null, nonmember_email: null, ...extra });
M.buildTmMap([
  tm('t-worship', { member_id: 'u-brennan' }),
  tm('t-worship', { member_id: 'u-grace' }),
  tm('t-worship', { member_type: 'nonmember', nonmember_name: 'Jordan Avery', nonmember_email: 'jordan@example.com' }),
  tm('t-welcome', { member_id: 'u-sarah' }),
  tm('t-welcome', { member_id: 'u-mike' }),                                   // married, but not to each other
  tm('t-kids',    { member_id: 'u-sarah' }),
  tm('t-kids',    { member_type: 'child',  member_id: 'u-brennan', child_id: 'c-noah' }),  // parent id rides along
  tm('t-kids',    { member_type: 'family', member_id: 'u-brennan' }),
  tm('t-av',      { member_id: 'u-mike' }),
  tm('t-av',      { member_id: 'u-jen' }),
]);

/* ── assertions ──────────────────────────────────────────────────────────── */
const parse = (html) => {
  const groups = {};
  for (const g of html.matchAll(/<optgroup label="([^"]+)">(.*?)<\/optgroup>/gs)) {
    groups[g[1]] = [...g[2].matchAll(/<option value="[^"]*">(.*?)<\/option>/g)].map(o => o[1]);
  }
  return { groups, values: [...html.matchAll(/value="([^"]*)"/g)].map(m => m[1]), html };
};
const opts = Object.fromEntries(teams.map(t => [t.id, parse(M.buildTeamOpts(t))]));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let failed = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const worship = opts['t-worship'];
check('worship offers only its own members', eq(worship.groups.Members, ['Brennan Cattani', 'Grace Lin']), JSON.stringify(worship.groups.Members));
check('worship hides people who serve on other teams', !/Sarah|Mike|Jen/.test(worship.html));
check('worship offers its non-member volunteer', eq(worship.groups['Non-members'], ['Jordan Avery']), JSON.stringify(worship.groups['Non-members']));
check('worship offers no children or families (none on the team)', !worship.groups.Children && !worship.groups.Families);
check('worship offers no couple (Brennan\'s spouse is not on the team)', !worship.groups.Couples);
check('worship keeps the one-off non-member entry (allow_nonmembers)', worship.values.includes('guest_inline'));

const av = opts['t-av'];
check('a/v offers the Olsen couple (both spouses on the team)', eq(av.groups.Couples, ['Jen &amp; Mike Olsen']) && av.values.includes('couple:u-jen:u-mike'), JSON.stringify(av.groups.Couples));
check('a/v offers no children although allow_children is on (none added to the team)', !av.groups.Children);

const kids = opts['t-kids'];
check('kids offers only its own member', eq(kids.groups.Members, ['Sarah Cattani']), JSON.stringify(kids.groups.Members));
check('kids offers only the child added to the team', eq(kids.groups.Children, ['Noah Cattani (Brennan Cattani)']), JSON.stringify(kids.groups.Children));
check('kids does not offer Ella (on no team)', !/Ella/.test(kids.html));
check('kids offers the family added to the team', eq(kids.groups.Families, ['Cattani Family']), JSON.stringify(kids.groups.Families));
check('a child row does not turn their parent into a team member', !(kids.groups.Members || []).some(n => n.includes('Brennan')));
check('kids has no one-off non-member entry (allow_nonmembers off)', !kids.values.includes('guest_inline'));

const welcome = opts['t-welcome'];
check('welcome offers no couple (its two members are not married to each other)', !welcome.groups.Couples, JSON.stringify(welcome.groups.Couples));
check('welcome sorts its members by name', eq(welcome.groups.Members, ['Mike Olsen', 'Sarah Cattani']), JSON.stringify(welcome.groups.Members));

check('a team with nobody on it says so', /No one on this team yet/.test(opts['t-setup'].html), opts['t-setup'].html);
check('teamRosterEmpty flags only the empty team', M.teamRosterEmpty(teams[4]) === true && M.teamRosterEmpty(teams[0]) === false);

/* pre-migration databases have no member_type column — those rows are members */
M.buildTmMap([{ team_id: 't-worship', member_id: 'u-grace' }]);
check('rows without member_type still read as members', /Grace Lin/.test(M.buildTeamOpts(teams[0])));

console.log(`\n${failed ? failed + ' check(s) FAILED' : 'All checks passed.'}`);
process.exit(failed ? 1 : 0);
