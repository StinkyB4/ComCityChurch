-- =============================================================================
-- FIX: "issues adding members to teams" (children & non-member volunteers)
--
-- Root cause: the team-add UI inserts team_members rows for children and
-- non-member volunteers. Non-member rows have member_id = NULL, but
-- team_members.member_id is declared NOT NULL (see supabase/schema.sql), so the
-- whole batch INSERT fails. The front-end fallback then re-inserts ONLY the
-- regular members, so children and non-members silently disappear and the user
-- sees a misleading "run the DB migration" toast.
--
-- This migration (a) ensures the extended columns exist and (b) makes member_id
-- nullable so child/non-member rows can be stored. Idempotent + safe to re-run.
-- Run AFTER sql/migrate_team_members_extended.sql (also re-applied here).
-- =============================================================================

-- (a) extended columns (no-op if already present)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS member_type     text DEFAULT 'member';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS child_id        uuid REFERENCES children(id) ON DELETE CASCADE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nonmember_name  text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nonmember_email text;
UPDATE team_members SET member_type = 'member' WHERE member_type IS NULL;

-- (b) allow member_id to be NULL (non-member volunteers have no profile)
ALTER TABLE team_members ALTER COLUMN member_id DROP NOT NULL;

-- (c) integrity guard: every row must identify someone, by exactly the
--     right field for its type. Prevents truly empty rows slipping in.
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_identity_chk;
ALTER TABLE team_members ADD CONSTRAINT team_members_identity_chk CHECK (
       (member_type = 'member'    AND member_id IS NOT NULL)
    OR (member_type = 'child'     AND child_id  IS NOT NULL)
    OR (member_type = 'nonmember' AND nonmember_name IS NOT NULL)
);

-- NOTE: the old UNIQUE(team_id, member_id) still applies to member rows.
-- With member_id NULL, multiple child/non-member rows per team are allowed
-- (NULLs are distinct in a UNIQUE index), which is the desired behaviour.
