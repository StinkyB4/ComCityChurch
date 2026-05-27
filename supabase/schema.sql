-- ============================================================================
-- COMMISSIONED CITY CHURCH — MEMBERS PORTAL DATABASE
-- ============================================================================
-- Row Level Security (RLS) enabled on all tables to restrict access by role

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PROFILES — Member identity and metadata
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  preferred_community UUID REFERENCES missional_communities(id),
  role TEXT NOT NULL DEFAULT 'member', -- 'member' | 'team' | 'admin'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'inactive'
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_community ON profiles(preferred_community);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Members see their own profile
CREATE POLICY "members_view_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- RLS: Members see approved team members (roster visibility)
CREATE POLICY "members_view_team_roster"
  ON profiles FOR SELECT
  USING (
    role = 'team' AND status = 'approved'
  );

-- RLS: Admins see all profiles
CREATE POLICY "admins_view_all_profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Members update their own profile
CREATE POLICY "members_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = OLD.role  -- prevent privilege escalation
    AND status = OLD.status  -- prevent self-approval
  );

-- RLS: Admins update any profile
CREATE POLICY "admins_update_all_profiles"
  ON profiles FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Authenticated users can insert their own initial profile (signup)
CREATE POLICY "members_insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id AND role = 'member' AND status = 'pending'
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 2. MISSIONAL_COMMUNITIES — Neighborhood groups
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS missional_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "South Osborne", "River Heights", "St. James", "Youth"
  description TEXT,
  leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  meeting_time TEXT, -- e.g., "Tuesday 7pm"
  meeting_location TEXT,
  color HEX DEFAULT '#112E53', -- brand color from design system
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communities_leader ON missional_communities(leader_id);

ALTER TABLE missional_communities ENABLE ROW LEVEL SECURITY;

-- RLS: All approved members see all communities
CREATE POLICY "members_view_communities"
  ON missional_communities FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
  );

-- RLS: Community leaders can update their community
CREATE POLICY "leaders_update_own_community"
  ON missional_communities FOR UPDATE
  USING (auth.uid() = leader_id)
  WITH CHECK (auth.uid() = leader_id);

-- RLS: Admins can update any community
CREATE POLICY "admins_update_all_communities"
  ON missional_communities FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Admins can insert communities
CREATE POLICY "admins_insert_communities"
  ON missional_communities FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 3. TEAMS — Staff/volunteer groups (e.g., "Music Team", "Parking")
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "Music", "Parking", "Welcome"
  description TEXT,
  leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  color HEX DEFAULT '#D5393B', -- accent from brand system
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- RLS: All approved members see all teams
CREATE POLICY "members_view_teams"
  ON teams FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
  );

-- RLS: Team leaders can update their team
CREATE POLICY "leaders_update_own_team"
  ON teams FOR UPDATE
  USING (auth.uid() = leader_id)
  WITH CHECK (auth.uid() = leader_id);

-- RLS: Admins can update any team
CREATE POLICY "admins_update_all_teams"
  ON teams FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Admins can insert teams
CREATE POLICY "admins_insert_teams"
  ON teams FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 4. TEAM_MEMBERS — Membership in teams
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'leader' | 'member'
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS: Approved members see team rosters
CREATE POLICY "members_view_team_members"
  ON team_members FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
  );

-- RLS: Team leaders can manage their team members
CREATE POLICY "leaders_manage_team_members"
  ON team_members FOR ALL
  USING (
    team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid())
  );

-- RLS: Admins can manage all team members
CREATE POLICY "admins_manage_all_team_members"
  ON team_members FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 5. ADMIN_MESSAGES — Announcements, prayer requests, notifications
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement', -- 'announcement' | 'prayer_request' | 'event'
  target_audience TEXT DEFAULT 'all', -- 'all' | 'members' | 'leaders' | 'team'
  target_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_author ON admin_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_type ON admin_messages(type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_published ON admin_messages(published_at DESC);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Approved members see all announcements
CREATE POLICY "members_view_announcements"
  ON admin_messages FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
    AND (
      target_audience = 'all'
      OR (target_audience = 'members' AND auth.uid() IN (SELECT id FROM profiles WHERE role != 'admin'))
      OR (target_audience = 'leaders' AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'team'))
      OR (target_team_id IN (SELECT team_id FROM team_members WHERE member_id = auth.uid()))
    )
  );

-- RLS: Admins create and edit messages
CREATE POLICY "admins_manage_messages"
  ON admin_messages FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 6. PRAYER_REQUESTS — Community prayer requests
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE, -- private = only requestor + admins see
  prayer_count INTEGER DEFAULT 0, -- count of "prayed for" responses
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_author ON prayer_requests(author_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_created ON prayer_requests(created_at DESC);

ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Approved members see public prayer requests
CREATE POLICY "members_view_public_requests"
  ON prayer_requests FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
    AND (is_private = FALSE OR auth.uid() = author_id)
  );

-- RLS: Admins see all prayer requests
CREATE POLICY "admins_view_all_requests"
  ON prayer_requests FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Approved members can submit prayer requests
CREATE POLICY "members_create_requests"
  ON prayer_requests FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
  );

-- RLS: Members edit their own requests
CREATE POLICY "members_update_own_requests"
  ON prayer_requests FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- RLS: Admins can delete requests
CREATE POLICY "admins_delete_requests"
  ON prayer_requests FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );


-- ──────────────────────────────────────────────────────────────────────────
-- TRIGGERS — Auto-update timestamps
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_timestamp BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER communities_timestamp BEFORE UPDATE ON missional_communities
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER teams_timestamp BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER admin_messages_timestamp BEFORE UPDATE ON admin_messages
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER prayer_requests_timestamp BEFORE UPDATE ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
