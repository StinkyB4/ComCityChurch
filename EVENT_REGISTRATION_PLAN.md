# Event Registration System — Build Plan

**Status:** Proposal · **Target branch:** `claude/event-registration-component-gu19qr`
**Author:** drafted against the codebase as of 2026-09-02

---

## 1. What we're building

An admin builds an event in the members portal. The event can accept public
registrations. The registration details and a link/form can be dropped onto
**any page of the website** with a one-line HTML snippet. Per event, the admin
chooses whether registrations are **approved automatically** or **held for admin
approval**. Registrants get a branded confirmation email containing **Add to
Calendar** links (Google / Outlook / Apple `.ics`). The system then sends
**automatic reminder emails** at offsets the admin selects when building the
event (1 week / 3 days / 1 day / morning-of / 2 hours before).

---

## 2. What we already have (and will reuse)

The good news: roughly 70% of the infrastructure this needs is already built and
running. This is mostly assembly, not greenfield.

| Capability | Where it lives today | How this feature reuses it |
|---|---|---|
| Postgres + RLS | `supabase/schema*.sql` | Two new tables + one view, same RLS conventions |
| Public read from a static page | `supabase-blog-setup.sql` policy `Public reads live posts` + `js/blog-public.js` anon REST fetch | Identical pattern for published events |
| Branded transactional email | `supabase/functions/send-email/index.ts` — `emailOpen/emailBody/emailButton/emailClose/emailEyebrow` helpers, navy `#112E53` + red `#D5393B`, Resend | New actions bolt straight into the existing `switch (action)` router |
| Scheduled email jobs | `supabase/functions/send-reminders/index.ts`, hourly `pg_cron` + `pg_net`, `schedule_log` dedupe table | New `send-event-reminders` function copies this shape exactly |
| Pluggable admin tab | `js/dashboard.js:358 renderTab()` → `window.mpDashboard['render_<tab>']` | New `js/dashboard-events.js` registers `render_events`; nav item in `members/dashboard.html` |
| Rich-text editing + image upload | `js/dashboard-blog.js`, `css/editor.css`, `blog-images` storage bucket | Event description editor + hero image |
| Date picker | `js/date-picker.js` | Event date/time fields |
| Auto-initialising page component | `js/main.js:122 MediaRenderer` scanning `[data-media]` | New `js/events-embed.js` scans `[data-ccc-event]` |
| Slug-driven detail page | `blog/post.html` + `?slug=` | `events/event.html` |
| Emailed token link that survives quoted-printable | `members/swap.html#<token>` (fragment, not `?token=` — see the comment in `send-reminders/index.ts`) | Registration self-manage/cancel link |
| Calendar file precedent | `sunday-gathering.ics` | Per-event `.ics` generation |
| Deploy | `.github/workflows/azure-deploy.yml`, push to `main` → Azure SWA | Unchanged; new files ship with the site |

### The one hard constraint

`supabase/security-patch.sql` deliberately strips `anon` of almost everything —
no anon INSERT anywhere, `REVOKE EXECUTE ... FROM PUBLIC` on every
`SECURITY DEFINER` function. **We must not weaken that.** A public registration
form therefore cannot write to Postgres directly with the anon key. All writes go
through a service-role **edge function**, which is also where validation, capacity
checks, spam defence and rate limiting belong. This is the single most important
architectural decision in the plan.

### Naming note

An `events` table already exists (`supabase/schema-v2-migration.sql:535`) — it is
the **members-only internal calendar**, readable only by approved members. It is
not the same concern. New tables are named `public_events` / `event_registrations`
to avoid collision and confusion.

---

## 3. Data model

### 3.1 `public_events`

```sql
CREATE TABLE IF NOT EXISTS public_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     TEXT UNIQUE NOT NULL,
  title                    TEXT NOT NULL,
  summary                  TEXT DEFAULT '',          -- one-line blurb for embed cards
  description              TEXT DEFAULT '',          -- rich HTML, from the blog editor
  hero_image_url           TEXT,

  starts_at                TIMESTAMPTZ NOT NULL,
  ends_at                  TIMESTAMPTZ,
  all_day                  BOOLEAN NOT NULL DEFAULT false,
  timezone                 TEXT NOT NULL DEFAULT 'America/Winnipeg',
  location_name            TEXT DEFAULT '',
  location_address         TEXT DEFAULT '',

  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','published','closed','cancelled')),

  -- ── the approval switch ──────────────────────────────────────────────
  approval_mode            TEXT NOT NULL DEFAULT 'auto'
                             CHECK (approval_mode IN ('auto','manual')),

  capacity                 INTEGER,                  -- NULL = unlimited
  waitlist_enabled         BOOLEAN NOT NULL DEFAULT false,
  registration_opens_at    TIMESTAMPTZ,
  registration_closes_at   TIMESTAMPTZ,

  allow_guests             BOOLEAN NOT NULL DEFAULT false,
  max_guests_per_reg       INTEGER NOT NULL DEFAULT 0,
  collect_phone            BOOLEAN NOT NULL DEFAULT true,
  collect_notes            BOOLEAN NOT NULL DEFAULT false,
  custom_questions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ "id":"q1", "label":"Dietary needs", "type":"text|select|checkbox",
    --    "required":false, "options":["…"] }]

  -- ── reminder offsets, in minutes before starts_at ────────────────────
  reminder_offsets         INTEGER[] NOT NULL DEFAULT '{1440}',
    -- 10080 = 1 week · 4320 = 3 days · 1440 = 1 day · 120 = 2 hours

  confirmation_message     TEXT DEFAULT '',          -- shown on-page after submit
  confirmation_email_note  TEXT DEFAULT '',          -- extra paragraph in the email
  contact_email            TEXT DEFAULT '',

  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_events_slug   ON public_events(slug);
CREATE INDEX IF NOT EXISTS idx_public_events_status ON public_events(status, starts_at);
```

`reminder_offsets` as an array (rather than a single column) costs nothing and
means "select one of those reminder emails" is satisfied while also supporting
"send a week out *and* the morning of" — which is what a retreat actually needs.

### 3.2 `event_registrations`

```sql
CREATE TABLE IF NOT EXISTS event_registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public_events(id) ON DELETE CASCADE,

  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL,
  phone          TEXT DEFAULT '',
  guest_count    INTEGER NOT NULL DEFAULT 0,
  notes          TEXT DEFAULT '',
  answers        JSONB NOT NULL DEFAULT '{}'::jsonb,

  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','declined','waitlisted','cancelled')),

  profile_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- set if a signed-in member registered
  manage_token   TEXT UNIQUE NOT NULL,     -- self-serve cancel link, used as a URL fragment
  source_page    TEXT DEFAULT '',          -- which page the embed was on — tells us what works
  ip_hash        TEXT,                     -- sha256(ip + salt), for rate limiting only

  approved_at    TIMESTAMPTZ,
  approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reg_event_email
  ON event_registrations (event_id, lower(email))
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_reg_event_status ON event_registrations(event_id, status);
```

### 3.3 `event_reminder_log` — idempotency

Same job `schedule_log` does for serving reminders. The unique constraint is the
lock: the reminder job **inserts first with `ON CONFLICT DO NOTHING`, and only
sends if the insert took**. That ordering is what prevents a double-send if the
cron fires twice or the function is retried.

```sql
CREATE TABLE IF NOT EXISTS event_reminder_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  offset_minutes  INTEGER NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, offset_minutes)
);
```

### 3.4 Availability view — "3 spots left" without leaking anyone's data

The public page needs a count. It must never be able to read the registrations
themselves. A view owned by `postgres` with `security_invoker = false` reads past
RLS and exposes only aggregates:

```sql
CREATE OR REPLACE VIEW public_event_availability
WITH (security_invoker = false) AS
SELECT
  e.id                                                          AS event_id,
  e.capacity,
  COALESCE(SUM(r.guest_count + 1) FILTER (
    WHERE r.status IN ('approved','pending')), 0)::int           AS taken,
  CASE WHEN e.capacity IS NULL THEN NULL
       ELSE GREATEST(e.capacity - COALESCE(SUM(r.guest_count + 1) FILTER (
              WHERE r.status IN ('approved','pending')), 0), 0) END::int AS spots_remaining
FROM public_events e
LEFT JOIN event_registrations r ON r.event_id = e.id
WHERE e.status = 'published'
GROUP BY e.id, e.capacity;

GRANT SELECT ON public_event_availability TO anon, authenticated;
```

### 3.5 RLS policies

```sql
ALTER TABLE public_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminder_log   ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors) reads published events. Mirrors the
-- blog_posts "Public reads live posts" policy.
CREATE POLICY "public_reads_published_events"
  ON public_events FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "admins_read_all_events"
  ON public_events FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "admins_write_events"
  ON public_events FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Registrations: admins only. No anon grant of any kind.
REVOKE ALL ON public.event_registrations FROM anon;
REVOKE ALL ON public.event_reminder_log  FROM anon;

CREATE POLICY "admins_manage_registrations"
  ON event_registrations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins_read_reminder_log"
  ON event_reminder_log FOR SELECT TO authenticated USING (public.is_admin());
```

Public inserts arrive only via the service-role edge function, which bypasses RLS.

> **Migration file:** `supabase/schema-v6-events.sql`, run in the Supabase SQL
> editor the same way every prior migration was.

---

## 4. Backend — edge functions

### 4.1 `event-register` (new, public endpoint)

`supabase/functions/event-register/index.ts`. Deployed with
`supabase functions deploy event-register --no-verify-jwt` so an unauthenticated
visitor can POST to it.

**Request:** `{ slug, first_name, last_name, email, phone, guest_count, answers, source_page, hp, elapsed_ms }`

**Sequence:**

1. Reject if honeypot field `hp` is non-empty, or if `elapsed_ms < 2000` (form
   filled faster than a human can type).
2. Rate limit: max 5 submissions per `ip_hash` per hour, 3 per email per day.
3. Load the event by slug with the service-role client. Reject unless
   `status = 'published'` and now is inside `[registration_opens_at, registration_closes_at]`.
4. Validate required custom questions, `guest_count <= max_guests_per_reg`.
5. Capacity check against the availability view. If full:
   `waitlist_enabled` → status `waitlisted`; otherwise reject with "This event is full."
6. Duplicate check on `(event_id, lower(email))` → "You're already registered" (and
   re-send their confirmation rather than erroring out).
7. Determine status:
   - `approval_mode = 'auto'` → **`approved`**, `approved_at = now()`
   - `approval_mode = 'manual'` → **`pending`**
8. Generate `manage_token` (`crypto.randomUUID().replace(/-/g,'')`, same as `buildServingToken`).
9. Insert, then fire emails:

| approval_mode | to registrant | to admin |
|---|---|---|
| `auto` | `event_registration_confirmed` — confirmed + **calendar links** | `event_registration_admin` (FYI) |
| `manual` | `event_registration_received` — "we'll confirm shortly", no calendar links yet | `event_registration_admin` — **Approve / Decline** buttons |

10. Return `{ ok, status, message }` — the message is the event's
    `confirmation_message`, or a sensible default.

**Approval later:** when an admin approves in the dashboard, `event_registration_confirmed`
fires then — that is the point at which calendar links are sent, because only then
is the person actually going.

### 4.2 `send-email` — six new actions

Appended to the existing router at `supabase/functions/send-email/index.ts:~470`.
They use the same `emailOpen / emailEyebrow / emailHeading / emailBody /
emailButton / emailClose` helpers, so they come out visually identical to every
other email the church sends.

| Action | Trigger | Contains |
|---|---|---|
| `event_registration_confirmed` | auto-registration, or admin approval | Event details card, **Add to Calendar** block, manage/cancel link, `confirmation_email_note` |
| `event_registration_received` | manual-approval registration | "Received — we'll confirm shortly" |
| `event_registration_admin` | every new registration | Registrant details + Approve/Decline deep link into the dashboard |
| `event_registration_declined` | admin declines | Gracious note + contact email |
| `event_registration_cancelled` | registrant self-cancels | Confirmation of cancellation |
| `event_reminder` | reminder cron | Event card, offset-aware subject, calendar links, cancel link |

### 4.3 Calendar links — the exact mechanics

Three helpers added to `send-email/index.ts`:

```ts
function icsStamp(iso: string): string {
  // 2026-10-04T18:00:00-05:00 → 20261004T230000Z
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function googleCalUrl(ev): string {
  const p = new URLSearchParams({
    action:   'TEMPLATE',
    text:     ev.title,
    dates:    `${icsStamp(ev.starts_at)}/${icsStamp(ev.ends_at || plusHours(ev.starts_at, 2))}`,
    details:  stripHtml(ev.summary || ev.description) + '\n\n' + SITE_URL + '/events/' + ev.slug,
    location: [ev.location_name, ev.location_address].filter(Boolean).join(', '),
    ctz:      ev.timezone,
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

function outlookCalUrl(ev): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent',
    subject: ev.title, startdt: ev.starts_at, enddt: ev.ends_at,
    body: stripHtml(ev.summary), location: [...].join(', '),
  });
  return 'https://outlook.live.com/calendar/0/deeplink/compose?' + p.toString();
}
```

Apple Calendar and Outlook desktop need a real `.ics` file. A third tiny edge
function, **`event-ics`**, returns one:

```
GET  https://<project>.supabase.co/functions/v1/event-ics?slug=fall-retreat-2026
→ 200  Content-Type: text/calendar; charset=utf-8
       Content-Disposition: attachment; filename="fall-retreat-2026.ics"
```

Its body is generated in the shape of the existing `sunday-gathering.ics` (same
`PRODID`, `VTIMEZONE` for `America/Winnipeg`, `SUMMARY`/`LOCATION`/`DESCRIPTION`
escaping rules), with a stable `UID` of `<event-id>@commissionedcity.church` so
that re-adding updates rather than duplicates.

**Also attach the `.ics` to the confirmation email.** Resend supports
`attachments: [{ filename, content: <base64> }]`. Gmail and Apple Mail render an
attached `.ics` as an inline RSVP widget above the message — a one-tap add. The
three buttons are the fallback for everyone else.

Rendered in the email as a bordered block:

```
  ADD TO YOUR CALENDAR
  [ Google Calendar ]  [ Outlook ]  [ Apple / Download .ics ]
```

### 4.4 `send-event-reminders` (new, cron)

`supabase/functions/send-event-reminders/index.ts` — a near-copy of
`send-reminders/index.ts`, minus the day/hour settings check (each event carries
its own offsets).

```sql
SELECT cron.schedule(
  'event-reminders', '0 * * * *',
  $$ SELECT net.http_post(
       url     := 'https://lkmphayrithxkmhvfiep.supabase.co/functions/v1/send-event-reminders',
       headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
       body    := '{}'::jsonb) $$
);
```

Each run:

1. Load published events with `starts_at > now()` and `starts_at < now() + 8 days`.
2. For each event, for each `offset_minutes` in `reminder_offsets`, compute
   `fire_at = starts_at - offset`. Act only if `fire_at` falls in the last hour
   (`now() - 1h < fire_at <= now()`).
3. Load that event's `approved` registrations.
4. For each: `INSERT INTO event_reminder_log (registration_id, offset_minutes)
   ON CONFLICT DO NOTHING RETURNING id` — **send only if a row came back**.
5. Subject adapts to the offset: *"Next week"* / *"Tomorrow"* / *"This morning"* /
   *"In 2 hours"*.

**Known granularity limit:** an hourly cron means a reminder fires within the hour
bucket its offset lands in. For "1 week / 1 day / morning of" that is invisible.
If we ever want a precise "2 hours before" on a 7:30pm event, move the cron to
`*/15 * * * *` — the function is already idempotent, so that is a one-line change
with no other consequences.

Add `{ force: true, event_id }` body support so the admin dashboard gets a
"Send reminder now" button, exactly as `send-reminders` already does.

---

## 5. Frontend

### 5.1 Admin builder — `js/dashboard-events.js`

Registers `window.mpDashboard.render_events`, following `js/dashboard-blog.js`
line for line (it waits for `window.mpDashboard.getSb`, then attaches). One nav
entry in `members/dashboard.html` beside the existing Blog/Email items:

```html
<a href="?tab=events" class="mp-nav-item mp-admin-only" data-tab="events"
   onclick="mpNavTo('events',event)" style="display:none;">Events</a>
```

…and one `<script src="/js/dashboard-events.js">` in the block at
`members/dashboard.html:165-180`. No changes to `dashboard.js` itself — the
`render_<tab>` lookup at `dashboard.js:365` already handles it.

**Screen 1 — Event list.** Upcoming / Drafts / Past. Each row: title, date,
`12 / 40 registered`, `3 pending approval` badge, status pill.

**Screen 2 — Event editor,** in collapsible sections:

- **Basics** — title, auto-slug, summary, description (reuse the blog editor
  toolbar and `css/editor.css`), hero image (new `event-images` bucket, same
  policy shape as `blog-images`)
- **When & Where** — start/end via `js/date-picker.js`, all-day toggle, location
- **Registration** —
  - **Approval: `( ) Register people automatically  ( ) I approve each registration`**
  - capacity (blank = unlimited), waitlist toggle
  - registration opens / closes
  - allow guests + max per registration
- **Form fields** — phone / notes toggles, plus a custom-question repeater
  (label, type, required) writing to `custom_questions`
- **Reminder emails** — checkbox group writing `reminder_offsets`:
  `☐ 1 week before  ☐ 3 days before  ☑ 1 day before  ☐ Morning of  ☐ 2 hours before`
- **Messaging** — on-page confirmation text, extra email paragraph, contact email
- Save draft / Publish

**Screen 3 — Embed panel** (this is the "place it anywhere" deliverable). Once
published, the editor shows copy-to-clipboard snippets:

```html
<!-- Card -->
<div data-ccc-event="fall-retreat-2026"></div>

<!-- Full-width banner -->
<div data-ccc-event="fall-retreat-2026" data-variant="banner"></div>

<!-- Just a button -->
<div data-ccc-event="fall-retreat-2026" data-variant="button"
     data-label="Save my spot"></div>

<!-- Form rendered inline on the page -->
<div data-ccc-event="fall-retreat-2026" data-variant="inline"></div>
```

plus the direct link `https://commissionedcity.church/events/fall-retreat-2026`.

**Screen 4 — Registrations table** for one event: search, status filter, capacity
meter, **Approve / Decline** buttons (which call `send-email` with the
corresponding action), resend confirmation, manually add someone, CSV export.

### 5.2 The public component — `js/events-embed.js`

Auto-initialises on `DOMContentLoaded` by scanning for `[data-ccc-event]` —
structurally the same idea as `MediaRenderer` scanning `[data-media]`
(`js/main.js:122-130`). Reads with the anon key over PostgREST exactly as
`js/blog-public.js:27 sbFetch()` does:

```
public_events?slug=eq.<slug>&status=eq.published&select=*
public_event_availability?event_id=eq.<id>&select=*
```

Four variants, all built from the site's existing `.card`, `.btn`,
`.btn-outline`, `.eyebrow` classes so they inherit the brand with almost no new
CSS. One small `css/events.css` covers the form and the modal.

| Variant | Renders |
|---|---|
| `card` (default) | Hero image, date chip, title, summary, location, "Register" |
| `banner` | Full-width navy strip: title + date + CTA |
| `button` | Bare CTA button |
| `inline` | The whole registration form, expanded on the page |

Clicking Register opens a modal with the form (or, with
`data-mode="link"`, navigates to the event page). Submission POSTs to
`event-register` and swaps the form for the success message. Graceful degradation
is inherited from the existing conventions: unknown slug, unpublished event, or a
failed fetch renders **nothing at all** and logs to console — a stale snippet left
on a page can never show a broken box to a visitor.

**One-time enablement:** add `<script src="/js/events-embed.js" defer></script>`
to the shared script block of each public page (the 9 top-level pages plus
`blog/`, `communities/`). After that, dropping an event onto any page is a
one-line paste with no developer involvement — which is the actual point of the
feature.

### 5.3 Standalone pages

| File | Route | Purpose |
|---|---|---|
| `events.html` | `/events` | Upcoming events index |
| `events/event.html` | `/events/*` | Full detail + registration form, reads slug from the path |
| `events/manage.html` | `/events/manage` | Self-serve view/cancel, reads `#<manage_token>` |

Added to `staticwebapp.config.json` `routes`:

```json
{ "route": "/events",         "rewrite": "/events.html" },
{ "route": "/events/manage",  "rewrite": "/events/manage.html" },
{ "route": "/events/*",       "rewrite": "/events/event.html" }
```

`manage.html` uses the **URL fragment**, not a query param — the same trick
`send-reminders/index.ts` documents for `swap.html`: quoted-printable encoding in
email mangles a bare `=` followed by hex, and a fragment contains no `=`. Token is
verified by an `event-manage` edge function (service role); cancelling frees
capacity and promotes the first waitlisted person.

---

## 6. Security

The registration form is the church's first unauthenticated write path. It gets
treated accordingly.

- **No anon writes to Postgres.** All inserts flow through `event-register` with
  the service-role key. `REVOKE ALL ON event_registrations FROM anon` is explicit
  in the migration.
- **Registrant PII is never publicly readable.** Counts come from an aggregate
  view; names, emails and phone numbers are admin-only.
- **Spam defence**, in layers: honeypot field, minimum fill time, per-IP and
  per-email rate limits, and a `guest_count` ceiling. If abuse appears, add
  Cloudflare Turnstile — the edge function is already the right chokepoint for it.
- **IPs are stored hashed** (`sha256(ip + salt)`), used only for rate limiting.
- Any new `SECURITY DEFINER` function follows `security-patch.sql`:
  `REVOKE EXECUTE ... FROM PUBLIC`, then grant selectively.
- `--no-verify-jwt` is set only on the three genuinely public functions
  (`event-register`, `event-ics`, `event-manage`). `send-event-reminders` keeps
  JWT verification and is called by `pg_cron` with the service-role key, matching
  `send-reminders`.
- `manage_token` is 32 hex chars and grants access to exactly one registration.

---

## 7. Build phases

| # | Phase | Deliverables | Est. |
|---|---|---|---|
| 0 | **Schema** | `supabase/schema-v6-events.sql` — 3 tables, view, RLS, storage bucket. Run in SQL editor. | 0.5 d |
| 1 | **Admin builder** | `js/dashboard-events.js`, nav + script tag in `members/dashboard.html`, `css/events-admin.css`. Create/edit/publish, incl. approval toggle and reminder checkboxes. | 2.5 d |
| 2 | **Public component** | `js/events-embed.js`, `css/events.css`, `events.html`, `events/event.html`, routes. Renders and reads; submits to a stub. | 2 d |
| 3 | **Registration + email** | `event-register` function; `send-email` actions `…confirmed` / `…received` / `…admin`; calendar helpers; `event-ics` function. Auto-approval path end to end. | 2 d |
| 4 | **Approval workflow** | Registrations table with Approve/Decline, `…declined` action, waitlist promotion, CSV export. Manual-approval path end to end. | 1.5 d |
| 5 | **Reminders** | `send-event-reminders` function, `event_reminder_log`, `pg_cron` entry, "Send now" button. | 1 d |
| 6 | **Self-manage** | `event-manage` function, `events/manage.html`, cancellation email. | 0.5 d |
| 7 | **Harden & document** | Rate limiting, honeypot, `tests/portal/` scripts for the register + reminder functions (following `send-reminders-sim.mjs`), README section, admin how-to. | 1 d |
|   | | **Total** | **≈ 11 working days** |

Phases 0–3 alone deliver a working system for auto-approval events with
confirmation emails and calendar links — a sensible first release if we want
something live sooner.

---

## 8. Decisions worth confirming before Phase 1

1. **Reminder offsets** — I've assumed the admin may pick *several* (1 week + 1 day,
   say). If it should be strictly one, the column becomes a single integer and the
   checkboxes become radios. Multi is the easier thing to narrow later.
2. **Members vs. public** — should a signed-in member's registration prefill from
   their profile and link via `profile_id`? Cheap to add in Phase 2, awkward to
   retrofit.
3. **Payment** — nothing in this plan takes money. If any event ever needs a fee,
   that is a separate integration (the `/give` page is still an unwired
   placeholder) and should not be smuggled into this build.
4. **Reminder timing precision** — hourly cron (proposed) vs. 15-minute. Hourly is
   fine unless "2 hours before" needs to be exact.
5. **Who receives admin notifications** — currently everything goes to the single
   `ADMIN_EMAIL` secret. Per-event `contact_email` is in the schema; we should
   decide whether it *replaces* or *adds to* `ADMIN_EMAIL` for that event's
   notifications.

---

## 9. New and changed files

**New**
```
supabase/schema-v6-events.sql
supabase/functions/event-register/index.ts
supabase/functions/event-ics/index.ts
supabase/functions/event-manage/index.ts
supabase/functions/send-event-reminders/index.ts
js/dashboard-events.js
js/events-embed.js
css/events.css
css/events-admin.css
events.html
events/event.html
events/manage.html
tests/portal/test-event-registration.mjs
tests/portal/event-reminders-sim.mjs
```

**Changed**
```
supabase/functions/send-email/index.ts   +6 actions, +3 calendar helpers
members/dashboard.html                   +1 nav item, +1 script tag
staticwebapp.config.json                 +3 routes
index.html … contact.html, blog/, communities/   +1 script tag each
README.md                                +Events section
```

Nothing in the existing schema, no existing table, and no current page behaviour
is modified. The feature is additive throughout.
