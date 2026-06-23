-- ============================================================================
-- COMMISSIONED CITY CHURCH — MEMBERS PORTAL v2 MIGRATION
-- ============================================================================
-- Run this AFTER schema.sql (the original schema must already exist).
-- All statements use IF NOT EXISTS / DO NOTHING so they are safe to re-run.
--
-- What this adds:
--   • Extended profile columns (phones, address, birthday, family, etc.)
--   • children table
--   • mc_members pivot table
--   • schedule_rosters, schedule_templates, guests, schedule_log
--   • swap_tokens table (for serving-swap contact links)
--   • sent_email_log table
--   • file_tree table (single-row JSONB document)
--   • Updated handle_new_user trigger (stores all registration fields)
--   • RLS policies for every new table


-- ──────────────────────────────────────────────────────────────────────────
-- 1. EXTEND PROFILES TABLE
-- ──────────────────────────────────────────────────────────────────────────

-- Split full_name into first/last for directory sorting and display
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Contact details
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone1_type TEXT DEFAULT 'Cell';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone1      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone2_type TEXT DEFAULT 'Home';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone2      TEXT;

-- Address (stored as individual fields + denormalised single string)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS addr_street   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS addr_city     TEXT DEFAULT 'Winnipeg';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS addr_province TEXT DEFAULT 'MB';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS addr_postal   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS addr_country  TEXT DEFAULT 'Canada';
-- Denormalised full address for fast display (e.g. "123 Main St, Winnipeg, MB  R3C 0A1, Canada")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Personal details
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday    DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anniversary DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender      TEXT CHECK (gender IN ('male','female',''));

-- Family linking
-- spouse_id points to another profile row (bidirectional once linked)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_id        UUID REFERENCES profiles(id) ON DELETE SET NULL;
-- Freetext name when spouse is NOT a member
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_name_text TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_is_member BOOLEAN DEFAULT false;

-- Directory visibility (admin can hide a profile)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_in_directory BOOLEAN DEFAULT true;

-- Flag to force password reset after admin resets it
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT false;

-- Rename 'status' logic: we keep status='approved' from original schema,
-- but also add a boolean shortcut used in JS comparisons
DROP VIEW IF EXISTS public.profiles_approved;
CREATE VIEW public.profiles_approved
  WITH (security_invoker = true)
  AS SELECT * FROM profiles WHERE status = 'approved';

-- Index for spouse lookups
CREATE INDEX IF NOT EXISTS idx_profiles_spouse ON profiles(spouse_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. CHILDREN TABLE
-- Each child is a separate row linked to one or both parents.
-- In practice only one parent's profile_id is stored (the registering member).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS children (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  gender     TEXT DEFAULT 'boy' CHECK (gender IN ('boy','girl')),
  birthday   DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_children_profile ON children(profile_id);

ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Members see their own children
CREATE POLICY "members_view_own_children"
  ON children FOR SELECT
  USING (profile_id = auth.uid());

-- Approved members see children of profiles they can see
CREATE POLICY "members_view_all_children"
  ON children FOR SELECT
  USING (public.is_approved_member());

-- Members manage their own children
CREATE POLICY "members_manage_own_children"
  ON children FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Admins manage all children
CREATE POLICY "admins_manage_all_children"
  ON children FOR ALL
  USING (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 3. MC_MEMBERS PIVOT TABLE
-- Links profiles to missional communities with an optional leader flag.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mc_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mc_id      UUID NOT NULL REFERENCES missional_communities(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_leader  BOOLEAN DEFAULT false,
  UNIQUE(mc_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_members_mc      ON mc_members(mc_id);
CREATE INDEX IF NOT EXISTS idx_mc_members_profile ON mc_members(profile_id);

ALTER TABLE mc_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_mc_members"
  ON mc_members FOR SELECT
  USING (public.is_approved_member());

CREATE POLICY "admins_manage_mc_members"
  ON mc_members FOR ALL
  USING (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 4. SCHEDULE_ROSTERS
-- One row per event date. The slots column stores the full slot array as JSONB.
--
-- slots structure:
-- [
--   {
--     "id": "slot_...",
--     "role": "Preacher",
--     "assignee_type": "member" | "couple" | "guest" | "",
--     "assignee_id": "<profile uuid or ''>",
--     "assignee_id_b": "<second profile uuid for couples or ''>",
--     "guest_id": "<guest uuid or ''>"
--   },
--   ...
-- ]
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_rosters (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL UNIQUE,
  title  TEXT NOT NULL DEFAULT 'Sunday Service',
  type   TEXT NOT NULL DEFAULT 'sunday' CHECK (type IN ('sunday','event')),
  notes  TEXT DEFAULT '',
  slots  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rosters_date ON schedule_rosters(date);

ALTER TABLE schedule_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_rosters"
  ON schedule_rosters FOR SELECT
  USING (public.is_approved_member());

CREATE POLICY "admins_manage_rosters"
  ON schedule_rosters FOR ALL
  USING (public.is_admin());

CREATE TRIGGER rosters_timestamp BEFORE UPDATE ON schedule_rosters
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- ──────────────────────────────────────────────────────────────────────────
-- 5. SCHEDULE_TEMPLATES
-- Reusable role structures for creating new rosters.
--
-- slots structure: [{"role": "Preacher", "count": 1}, ...]
-- is_default = true → the one default template (only one should be true at a time)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  slots      JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_templates"
  ON schedule_templates FOR SELECT
  USING (public.is_approved_member());

CREATE POLICY "admins_manage_templates"
  ON schedule_templates FOR ALL
  USING (public.is_admin());

CREATE TRIGGER templates_timestamp BEFORE UPDATE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Seed the default template (mirrors mp_default_template_seed() from PHP)
INSERT INTO schedule_templates (name, is_default, slots)
VALUES (
  'Default (Sunday Service)',
  true,
  '[
    {"role":"Preacher","count":1},
    {"role":"Setup","count":2},
    {"role":"Bread","count":1},
    {"role":"Music Leader","count":1},
    {"role":"Musicians/Singers","count":4},
    {"role":"Sound","count":1},
    {"role":"Slides","count":1},
    {"role":"Cleanup","count":1},
    {"role":"Greeters","count":2},
    {"role":"Children''s Ministry","count":4}
  ]'
)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────────
-- 6. GUESTS  (non-member volunteers who can be assigned to roster slots)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_guests"
  ON guests FOR SELECT
  USING (public.is_approved_member());

CREATE POLICY "admins_manage_guests"
  ON guests FOR ALL
  USING (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 7. SCHEDULE_LOG  (audit trail of reminder sends)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  this_date  DATE,
  next_date  DATE,
  count      INTEGER DEFAULT 0   -- number of reminder emails sent
);

ALTER TABLE schedule_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_schedule_log"
  ON schedule_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admins_insert_schedule_log"
  ON schedule_log FOR INSERT
  WITH CHECK (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 8. SWAP_TOKENS  (7-day expiring links for swap contact pages)
-- token is a random 24-char string (generated by crypto.randomUUID or similar)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS swap_tokens (
  token       TEXT PRIMARY KEY,
  date        DATE NOT NULL,          -- which roster date this swap link is for
  role        TEXT NOT NULL,          -- the role the person is serving
  person_name TEXT NOT NULL,          -- first name of the serving person
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_swap_tokens_expires ON swap_tokens(expires_at);

-- RLS enabled. The edge function uses the service role key which bypasses RLS,
-- so enabling RLS here does not affect the swap-token edge function.
-- Anon users have no direct PostgREST access; the token is validated server-side.
ALTER TABLE swap_tokens ENABLE ROW LEVEL SECURITY;

-- Revoke any prior broad grant to anon
REVOKE SELECT, INSERT, DELETE ON public.swap_tokens FROM anon;

-- Admins can manage tokens (e.g. manual cleanup)
CREATE POLICY "admins_manage_swap_tokens"
  ON swap_tokens FOR ALL
  USING (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 9. SENT_EMAIL_LOG  (audit log for admin-sent emails)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sent_email_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT,
  body       TEXT,
  recipients TEXT[],            -- array of email addresses
  sent_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_by    TEXT,              -- name of the admin who sent it
  success    BOOLEAN DEFAULT true,
  type       TEXT DEFAULT 'general'  -- 'weekly' | 'special' | 'general'
);

ALTER TABLE sent_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_sent_log"
  ON sent_email_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admins_insert_sent_log"
  ON sent_email_log FOR INSERT
  WITH CHECK (public.is_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 10. FILE_TREE  (single-row JSONB document mirroring mp_file_tree WP option)
--
-- tree JSONB structure (recursive):
-- [
--   {
--     "type": "folder",
--     "id": "fld_...",
--     "name": "Meeting Minutes",
--     "children": [
--       {
--         "type": "file",
--         "id": "file_...",
--         "name": "January 2026",
--         "filename": "jan-2026.pdf",
--         "url": "https://...",
--         "uploaded_at": 1700000000,
--         "uploaded_by": "<profile-uuid>"
--       }
--     ]
--   },
--   {
--     "type": "file",
--     "id": "file_...",
--     "name": "Church Constitution",
--     ...
--   }
-- ]
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_tree (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE file_tree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_file_tree"
  ON file_tree FOR SELECT
  USING (public.is_approved_member());

CREATE POLICY "admins_manage_file_tree"
  ON file_tree FOR ALL
  USING (public.is_admin());

-- Seed one row so there is always exactly one tree document
INSERT INTO file_tree (tree) VALUES ('[]') ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────────
-- 11. UPDATE handle_new_user TRIGGER
-- Extended to store first_name, last_name and all additional registration
-- fields passed via auth.signUp() options.data.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB;
BEGIN
  meta := NEW.raw_user_meta_data;

  INSERT INTO public.profiles (
    id, email, full_name, first_name, last_name,
    phone1_type, phone1, phone2_type, phone2,
    addr_street, addr_city, addr_province, addr_postal, addr_country, address,
    birthday, anniversary, gender, bio,
    role, status, must_reset_password
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(meta->>'full_name', ''),
    COALESCE(meta->>'first_name', ''),
    COALESCE(meta->>'last_name',  ''),
    COALESCE(meta->>'phone1_type', 'Cell'),
    COALESCE(meta->>'phone1', ''),
    COALESCE(meta->>'phone2_type', 'Home'),
    COALESCE(meta->>'phone2', ''),
    COALESCE(meta->>'addr_street',   ''),
    COALESCE(meta->>'addr_city',     'Winnipeg'),
    COALESCE(meta->>'addr_province', 'MB'),
    COALESCE(meta->>'addr_postal',   ''),
    COALESCE(meta->>'addr_country',  'Canada'),
    COALESCE(meta->>'address',       ''),
    NULLIF(meta->>'birthday', '')::DATE,
    NULLIF(meta->>'anniversary', '')::DATE,
    COALESCE(meta->>'gender', ''),
    COALESCE(meta->>'bio', ''),
    'member',
    'pending',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger already exists from v1; DROP + RECREATE to pick up function changes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────────────────
-- 12. ADDITIONAL RLS POLICIES ON EXISTING TABLES
-- ──────────────────────────────────────────────────────────────────────────

-- Allow approved members to see all OTHER approved members (for directory)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'members_view_approved_members'
  ) THEN
    CREATE POLICY "members_view_approved_members"
      ON profiles FOR SELECT
      USING (status = 'approved' AND public.is_approved_member());
  END IF;
END$$;

-- Admins can delete profiles (for reject workflow), but NOT admin accounts.
-- See schema-v5-migration.sql for the rationale and escape hatch.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admins_delete_non_admin_profiles'
  ) THEN
    CREATE POLICY "admins_delete_non_admin_profiles"
      ON profiles FOR DELETE
      USING (public.is_admin() AND role <> 'admin');
  END IF;
END$$;

-- Make teams.leader_id nullable so a team can be created without assigning a leader upfront.
-- The original schema had NOT NULL + ON DELETE SET NULL which is contradictory (deleting a leader
-- profile would try to set the column to NULL, violating the NOT NULL constraint).
ALTER TABLE teams ALTER COLUMN leader_id DROP NOT NULL;

-- Admins can delete teams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'admins_delete_teams'
  ) THEN
    CREATE POLICY "admins_delete_teams"
      ON teams FOR DELETE
      USING (public.is_admin());
  END IF;
END$$;

-- Admins can delete communities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'missional_communities' AND policyname = 'admins_delete_communities'
  ) THEN
    CREATE POLICY "admins_delete_communities"
      ON missional_communities FOR DELETE
      USING (public.is_admin());
  END IF;
END$$;

-- Admins can delete messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_messages' AND policyname = 'admins_delete_messages'
  ) THEN
    CREATE POLICY "admins_delete_messages"
      ON admin_messages FOR DELETE
      USING (public.is_admin());
  END IF;
END$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 13. STORAGE BUCKET FOR MEMBER FILES
-- Run manually in Supabase dashboard or via supabase CLI:
--   supabase storage create member-files --public=false
-- ──────────────────────────────────────────────────────────────────────────
-- NOTE: Storage buckets cannot be created via SQL in the hosted Supabase.
-- Create the 'member-files' bucket manually in the Supabase Storage dashboard
-- with public = false, and set the following policy:
--
--   Name: "members_upload_files"
--   Allowed operations: SELECT, INSERT, DELETE
--   Policy expression: auth.uid() IN (SELECT id FROM profiles WHERE status='approved')
--
-- The 'avatars' bucket from v1 remains unchanged.


-- ──────────────────────────────────────────────────────────────────────────
-- 14. EVENTS TABLE
-- Church events created by admins or team leaders, with visibility controls.
-- visibility = 'all'  → shown to all approved members
-- visibility = 'team' → shown only to members of target_team_id
-- visibility = 'mc'   → shown only to members of target_mc_id
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT DEFAULT '',
  event_date     DATE NOT NULL,
  event_time     TEXT DEFAULT '',
  visibility     TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all','team','mc')),
  target_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  target_mc_id   UUID REFERENCES missional_communities(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date       ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_events"
  ON events FOR SELECT
  USING (
    public.is_approved_member() AND (
      visibility = 'all'
      OR (visibility = 'team' AND target_team_id IN (
        SELECT team_id FROM team_members WHERE member_id = auth.uid()
      ))
      OR (visibility = 'mc' AND target_mc_id IN (
        SELECT mc_id FROM mc_members WHERE profile_id = auth.uid()
      ))
    )
  );

CREATE POLICY "leaders_manage_events"
  ON events FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','team'))
  );

CREATE TRIGGER events_timestamp BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- ──────────────────────────────────────────────────────────────────────────
-- END OF MIGRATION
-- ──────────────────────────────────────────────────────────────────────────
