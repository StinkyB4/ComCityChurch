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

-- Security definer functions bypass RLS on the profiles table, preventing
-- infinite recursion in policies that need to check role/status.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_approved_member()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
$$;

-- RLS: Members see their own profile
CREATE POLICY "members_view_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- RLS: Members see other approved members
CREATE POLICY "members_view_approved_members"
  ON profiles FOR SELECT
  USING (status = 'approved' AND public.is_approved_member());

-- RLS: Members see approved team members (roster visibility)
CREATE POLICY "members_view_team_roster"
  ON profiles FOR SELECT
  USING (
    role = 'team' AND status = 'approved'
  );

-- RLS: Admins see all profiles
CREATE POLICY "admins_view_all_profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS: Admins delete profiles
CREATE POLICY "admins_delete_profiles"
  ON profiles FOR DELETE
  USING (public.is_admin());

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
  leader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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
  target_audience TEXT DEFAULT 'all', -- 'all' | 'members' | 'leaders' | 'mc' | 'team'
  target_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  target_mc_id UUID REFERENCES missional_communities(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Migration: add target_mc_id to existing deployments
-- ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS target_mc_id UUID REFERENCES missional_communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_messages_author ON admin_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_type ON admin_messages(type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_published ON admin_messages(published_at DESC);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Approved members see announcements targeted to them
CREATE POLICY "members_view_announcements"
  ON admin_messages FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE status = 'approved')
    AND (
      target_audience = 'all'
      OR (target_audience = 'members' AND auth.uid() IN (SELECT id FROM profiles WHERE role != 'admin'))
      OR (target_audience = 'leaders' AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'team'))
      OR (target_team_id IS NOT NULL AND target_team_id IN (SELECT team_id FROM team_members WHERE member_id = auth.uid()))
      OR (target_mc_id IS NOT NULL AND target_mc_id IN (SELECT preferred_community FROM profiles WHERE id = auth.uid()))
    )
  );

-- RLS: Admins create, edit and delete any message
CREATE POLICY "admins_manage_messages"
  ON admin_messages FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- RLS: Leaders can post messages to their own MC or team
CREATE POLICY "leaders_insert_group_messages"
  ON admin_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('team', 'admin'))
    AND (
      (target_mc_id IS NOT NULL AND target_mc_id IN (
        SELECT id FROM missional_communities WHERE leader_id = auth.uid()
      ))
      OR (target_team_id IS NOT NULL AND target_team_id IN (
        SELECT id FROM teams WHERE leader_id = auth.uid()
        UNION
        SELECT team_id FROM team_members WHERE member_id = auth.uid() AND role = 'leader'
      ))
    )
  );

-- RLS: Leaders can delete their own messages
CREATE POLICY "leaders_delete_own_messages"
  ON admin_messages FOR DELETE
  USING (
    author_id = auth.uid()
    AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('team', 'admin'))
  );


-- ──────────────────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- Fires when a row is inserted into auth.users (i.e. every new sign-up).
-- Runs as SECURITY DEFINER so it bypasses RLS — profile is always created
-- regardless of whether email confirmation is enabled.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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
