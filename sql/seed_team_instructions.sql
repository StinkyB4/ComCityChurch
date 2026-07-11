-- =============================================================================
-- Placeholder serving instructions / checklists for each team, plus a new
-- "Lock Up" serving team. Safe to re-run (idempotent).
--
-- Run this in the Supabase SQL editor AFTER (or instead of) running
-- sql/migrate_team_instructions.sql — the column guards below make it
-- self-contained.
--
-- TEAM NAMES: confirmed against the live Teams list. Setup, Sound, Slides,
-- Music, and Clean Up already exist and are matched by name (case-insensitive).
-- Greeting and Lock Up do not exist, so they are created as new Sunday-serving
-- teams. The verification query at the bottom shows what ended up with
-- instructions after running.
--
-- These are PLACEHOLDERS and are set to appear in reminder emails
-- (include_instructions_in_reminder = true). Edit the wording any time from
-- the Teams tab, and untick "Include these instructions in the serving
-- reminder email" on any team you're not ready to surface yet.
-- =============================================================================

-- ── Column guards (idempotent) ──────────────────────────────────────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS include_instructions_in_reminder boolean NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_sunday_serving boolean NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS serving_order integer NOT NULL DEFAULT 0;

-- ── Setup ───────────────────────────────────────────────────────────────────
UPDATE teams SET
  instructions = $doc$Arrive by 8:30 AM to open the building.

[ ] Unlock the main entrances
[ ] Turn on the lights and set the thermostat
[ ] Set out chairs (rows of 8)
[ ] Set up the stage, podium, and music stands
[ ] Start the coffee and put out refreshments
[ ] Put out signage and the welcome table$doc$,
  include_instructions_in_reminder = true
WHERE lower(name) = lower('Setup');

-- ── Sound ───────────────────────────────────────────────────────────────────
UPDATE teams SET
  instructions = $doc$Arrive by 8:15 AM for soundcheck.

[ ] Power on the sound board, amps, and speakers
[ ] Check all mics (fresh batteries in wireless)
[ ] Soundcheck with the worship team
[ ] Set levels for both speaking and music
[ ] Start the recording / livestream if applicable
[ ] Do a final line check before the service starts$doc$,
  include_instructions_in_reminder = true
WHERE lower(name) = lower('Sound');

-- ── Slides ──────────────────────────────────────────────────────────────────
UPDATE teams SET
  instructions = $doc$Arrive by 8:30 AM to load today's presentation.

[ ] Boot the presentation computer and projector
[ ] Load today's slide deck and song lyrics
[ ] Confirm the song order and keys with the worship lead
[ ] Add announcement and giving slides
[ ] Test the advance / back clicker
[ ] Advance slides on cue during the service$doc$,
  include_instructions_in_reminder = true
WHERE lower(name) = lower('Slides');

-- ── Music ───────────────────────────────────────────────────────────────────
UPDATE teams SET
  instructions = $doc$Arrive by 8:15 AM for rehearsal.

[ ] Set up and tune your instrument
[ ] Confirm the setlist, keys, and arrangements
[ ] Run through transitions and any new songs
[ ] Coordinate with the sound and slides teams
[ ] Pray with the team before the service$doc$,
  include_instructions_in_reminder = true
WHERE lower(name) = lower('Music');

-- ── Greeting (new serving team — no existing "Greeting"/"Welcome" team) ─────
-- Created as a Sunday-serving team so it appears as a schedule role. If you'd
-- rather map this to an existing team, replace this INSERT with an UPDATE like
-- the ones above (WHERE lower(name) = lower('<your team>')).
INSERT INTO teams (name, is_sunday_serving, serving_order, instructions, include_instructions_in_reminder)
VALUES (
  'Greeting',
  true,
  60,
  $doc$Arrive by 9:00 AM, ready to welcome people.

[ ] Prop open the main doors
[ ] Hand out bulletins
[ ] Warmly welcome newcomers and offer directions
[ ] Staff the welcome / info table
[ ] Help point people to coffee and kids check-in
[ ] Keep an eye out for anyone who looks lost or new$doc$,
  true
)
ON CONFLICT (name) DO UPDATE SET
  is_sunday_serving = true,
  instructions = EXCLUDED.instructions,
  include_instructions_in_reminder = true,
  serving_order = COALESCE(NULLIF(teams.serving_order, 0), EXCLUDED.serving_order);

-- ── Clean Up ────────────────────────────────────────────────────────────────
UPDATE teams SET
  instructions = $doc$Begin once the service and fellowship time have wrapped up.

[ ] Stack and store the chairs
[ ] Wipe down tables and surfaces
[ ] Empty the trash and recycling
[ ] Clean the kitchen and coffee station
[ ] Sweep / vacuum high-traffic areas
[ ] Return all equipment to storage$doc$,
  include_instructions_in_reminder = true
WHERE lower(name) = lower('Clean Up');

-- ── Lock Up (new serving team / schedule role) ──────────────────────────────
INSERT INTO teams (name, is_sunday_serving, serving_order, instructions, include_instructions_in_reminder)
VALUES (
  'Lock Up',
  true,
  90,  -- display order: last, after Clean Up
  $doc$The last team out — make sure the building is secure before you leave.

[ ] Check each room (empty, tidy, nothing left running)
[ ] Turn off all lights
[ ] Close all windows
[ ] Lock all 3 sets of doors
[ ] Set the alarm$doc$,
  true
)
ON CONFLICT (name) DO UPDATE SET
  is_sunday_serving = true,
  instructions = EXCLUDED.instructions,
  include_instructions_in_reminder = true,
  serving_order = COALESCE(NULLIF(teams.serving_order, 0), EXCLUDED.serving_order);

-- ── Verify: which teams now carry instructions? ─────────────────────────────
-- Review this output to confirm all six existing teams matched by name (and
-- that "Lock Up" was created). Any team you expected but don't see here needs
-- its name adjusted in the WHERE clauses above.
SELECT name,
       is_sunday_serving,
       include_instructions_in_reminder,
       left(instructions, 60) || '…' AS instructions_preview
FROM teams
WHERE instructions IS NOT NULL AND instructions <> ''
ORDER BY serving_order, name;
