-- =============================================================================
-- Allow "family" team_members rows (a couple + their children assigned as one
-- unit). A family row is anchored to one parent: member_type = 'family',
-- member_id = that parent's profile id (the spouse + children are derived).
--
-- The identity CHECK added in fix_team_members_add_children_nonmembers.sql only
-- knew about member / child / nonmember, so a 'family' row would fail it.
-- This widens the CHECK to accept 'family'. Idempotent + safe to re-run.
--
-- (The partial-unique fix in fix_team_members_parent_child_unique.sql already
--  scopes uniqueness to member_type='member', so a family row sharing a parent's
--  member_id with a 'member' row does not collide.)
-- =============================================================================

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_identity_chk;
ALTER TABLE team_members ADD CONSTRAINT team_members_identity_chk CHECK (
       (member_type = 'member'    AND member_id IS NOT NULL)
    OR (member_type = 'child'     AND child_id  IS NOT NULL)
    OR (member_type = 'nonmember' AND nonmember_name IS NOT NULL)
    OR (member_type = 'family'    AND member_id IS NOT NULL)
);
