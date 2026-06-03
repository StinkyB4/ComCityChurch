-- Extend team_members to support individual members, children, families, and non-member volunteers
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS member_type text DEFAULT 'member';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id) ON DELETE CASCADE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nonmember_name text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nonmember_email text;

-- Backfill existing rows
UPDATE team_members SET member_type = 'member' WHERE member_type IS NULL;
