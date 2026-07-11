-- One "Full Serving Team" link per reminder now carries the recipient's team(s)
-- for that day, so the landing page can show their relevant checklists. Stored
-- as a comma-separated list of team UUIDs. Nullable — older per-role tokens
-- simply won't have it, and the page falls back to matching by role.
ALTER TABLE swap_tokens ADD COLUMN IF NOT EXISTS team_ids text;
