# Members-Portal Mock Tests

Tests the serving-schedule, welcome-page notifications, team management, and
reminder emails **without a live Supabase backend**, by injecting an in-memory
mock of `@supabase/supabase-js` into the real portal pages.

> Nothing is written to the production database and **no emails are sent**.

## Files

| File | What it does |
|------|--------------|
| `seed.mjs` | Shared fake dataset (a scheduler, volunteers, a couple, children, a guest, teams, roster mock-ups, events). Computes "this/next Sunday" dynamically. |
| `mock-supabase.js` | Browser-side fake Supabase client (chainable query builder + auth/storage/channel/rpc stubs) backed by the seed. Served to pages in place of the CDN bundle. |
| `run-portal-tests.mjs` | Puppeteer driver. Logs in as each person, drives the real dashboard UI, asserts notifications, drives the team-add form, screenshots everything. |
| `send-reminders-sim.mjs` | Faithful Node port of `supabase/functions/send-reminders` run against the seed. Captures the emails it *would* send to `results/emails/*.html`. |

## Run

```bash
cd tests/portal
npm install                 # Puppeteer (Chromium cached from tests/ux)
node send-reminders-sim.mjs # reminder-email logic + captured emails
node run-portal-tests.mjs   # UI: welcome notifications, scheduler, team add, render emails
```

Output: `results/portal-report.json`, `results/emails/*.html`,
`results/screenshots/*.png`, `results/team-add-insert-payload.json`.

## What this can and cannot catch

- **Can**: front-end behavior, notification rendering, the exact rows the UI
  tries to write, and the reminder-email targeting/content logic.
- **Cannot**: backend-only failures (RLS policies, NOT NULL / column
  constraints). Those are diagnosed by reading the schema — see
  `../../sql/fix_team_members_add_children_nonmembers.sql`.
