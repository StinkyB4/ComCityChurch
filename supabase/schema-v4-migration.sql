-- ============================================================================
-- COMMISSIONED CITY CHURCH — MEMBERS PORTAL v4 MIGRATION
-- ============================================================================
-- Run this AFTER schema-v3-migration.sql.
--
-- What this adds:
--   • is_leader() helper function — true for role='admin' or role='team'
--   • Updated schedule_rosters RLS policy to allow team leaders to write
--     (admins_manage_rosters previously blocked role='team' users on INSERT/UPDATE)
-- ============================================================================

-- Helper: true for any user with a leadership role (team leader or admin)
CREATE OR REPLACE FUNCTION public.is_leader()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
$$;


-- Drop the old admin-only write policy and replace it with one that also
-- allows team leaders (role='team') to manage roster rows.
DROP POLICY IF EXISTS "admins_manage_rosters" ON schedule_rosters;

CREATE POLICY "leaders_manage_rosters"
  ON schedule_rosters FOR ALL
  USING (public.is_leader())
  WITH CHECK (public.is_leader());
