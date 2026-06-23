# Members-Portal Test Findings (mock backend)

Scenario seeded as "the scheduler": Pastor Tim (admin) built Sunday rosters for
this & next Sunday. Cast: Brennan + Sarah (married, parents of Noah & Ella),
Mike + Jen (married couple), Grace (single), Jordan Avery (non-member/guest).

## ✅ What works (verified)

1. **Volunteer welcome-page notifications** — all 4 volunteers see their own
   "Your Upcoming Serving" card with the correct dates/roles.
2. **Children scheduling → parent notifications** — both parents see their kids:
   - red "Noah is serving this week" in-portal card (`member_notifications`)
   - purple "Your Children Are Serving This Week" card (from `events`)
3. **Scheduler master grid** — renders all teams × Sundays with the seeded
   assignments, incl. couples (Mike & Jen) and children (Noah, Ella).
4. **Reminder emails** (logic-faithful simulation, nothing sent) — 6 emails:
   - Brennan → "Worship Lead **& Kids Helper (Noah)**" + next week "Greeter **& Kids Helper (Ella)**"
   - Sarah → "Greeter **& Kids Helper (Noah)**" + next week "Kids Lead **& Kids Helper (Ella)**"
   - Mike & Jen → one each for the couple A/V slot
   - Grace → Vocals; Jordan (non-member) → Coffee
   - **Both parents get each child's reminder** ✔ (requirement met)
5. **Team-add front-end** — the form correctly builds insert rows for members,
   children (member_id = parent), and non-members.

## 🐞 Bugs found

### 1. Adding children / non-members to a team fails on the live DB  (HIGH)
The team-add form builds a non-member row with `member_id = NULL`
(see `results/team-add-insert-payload.json`), but `team_members.member_id` is
`NOT NULL` (`supabase/schema.sql:200`). The whole batch INSERT fails; the
front-end fallback (`js/dashboard-tabs.js:1117-1122`) then re-inserts **only
regular members**, so **children and non-members silently vanish** and the user
sees a misleading "run the DB migration" toast.
Also fails if `migrate_team_members_extended.sql` (member_type/child_id/…) was
never applied to prod.
**Fix:** `sql/fix_team_members_add_children_nonmembers.sql` (makes member_id
nullable + ensures columns + integrity check). *Confirm against your live DB —
this is diagnosed from the committed schema, not a prod query.*

### 2. Silent failures in team-save error handling  (MEDIUM)
- `js/dashboard-tabs.js:1118` only handles insert errors whose message contains
  the word "column". Any other error (RLS, NOT NULL, FK) is **swallowed with no
  alert/toast** — the UI looks like it saved.
- `js/dashboard-admin.js:526` inserts team rows with **no error check at all**.
**Fix:** surface the real error to the user; in the fallback, also re-insert
child/non-member rows (or rely on the schema fix so no fallback is needed).

### 3. Reminder emails use the OLD brand  (LOW / cosmetic)
`supabase/functions/send-reminders/index.ts` renders emails in brown
`#7a4a35` + Georgia serif (old "Osborne Village" look), not the new navy
`#112E53` / red `#D5393B` Commissioned City brand. See
`results/screenshots/email-*.png`.

### 4. Email wording for child slots  (LOW / polish)
A parent who also serves gets one merged line: "You're on Worship Lead **&
Kids Helper (Noah)**". The child portion reads as if the parent serves it.
Consider "You're on Worship Lead. Noah is on Kids Helper." for clarity.

## Caveats
Backend behaviors (RLS, constraints) are inferred from the committed
schema/migrations because the mock has no constraints and production was
deliberately not queried. Findings #1/#2 should be confirmed against the live DB.
