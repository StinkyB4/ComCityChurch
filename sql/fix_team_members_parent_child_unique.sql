-- =============================================================================
-- FIX: building a team with a parent + their child(ren), or with two siblings,
-- wipes the whole team.
--
-- Root cause: child rows in team_members store member_id = the PARENT's id
-- (so a child's membership is associated with the parent). The blanket
-- UNIQUE(team_id, member_id) then collides whenever:
--   * a parent and their child are both on a team, or
--   * two children of the same family are on a team
-- because all those rows carry the same member_id. Confirmed live:
--   SQLSTATE 23505 — duplicate key value violates unique constraint
--   "team_members_team_id_member_id_key".
-- The team-save flow deletes the team's rows first and then re-inserts, so when
-- the insert hits the unique violation the batch rolls back and the team is
-- left EMPTY.
--
-- Fix: uniqueness should only prevent the SAME MEMBER being added to a team
-- twice. Replace the blanket constraint with a PARTIAL unique index scoped to
-- member_type = 'member', so any mix of parents and children can coexist.
-- Idempotent + safe to re-run.
-- =============================================================================

-- Drop the over-broad constraint (collides on parent/child shared member_id).
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_team_id_member_id_key;

-- Keep "a member can't be added to the same team twice" — for members only.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_member
  ON team_members (team_id, member_id)
  WHERE member_type = 'member';
