-- ─────────────────────────────────────────────────────────────────────────────
-- AGE-18 TRANSITION POLICY  (schema-v5)
-- Adds transition tracking to children and creates a per-user notification inbox.
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Fix children INSERT permission ────────────────────────────────────────
-- The existing FOR ALL policy on children uses only a USING clause for INSERT
-- visibility, but PostgreSQL only evaluates WITH CHECK for INSERT operations.
-- Add explicit INSERT + DELETE policies so direct table writes work correctly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'children'
    AND policyname = 'members_insert_own_children'
  ) THEN
    CREATE POLICY "members_insert_own_children"
      ON public.children FOR INSERT
      WITH CHECK (profile_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'children'
    AND policyname = 'members_delete_own_children'
  ) THEN
    CREATE POLICY "members_delete_own_children"
      ON public.children FOR DELETE
      USING (profile_id = auth.uid());
  END IF;
END$$;

-- Ensure the authenticated role has table-level INSERT/DELETE privileges
-- (RLS gates row access; GRANT gates table access — both are required)
GRANT INSERT, DELETE ON public.children TO authenticated;

-- ── 1. Extend children with transition state ──────────────────────────────────
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS transition_state text DEFAULT 'none',
  -- Allowed values:
  --   'none'        – not yet processed
  --   'warned_7d'   – 7-day warning sent to parents
  --   'turned_18'   – 18th birthday processed, 6-month clock started
  --   'transitioned' – 6-month window closed; team leaders notified (or child registered)
  ADD COLUMN IF NOT EXISTS turned_18_at date,
  ADD COLUMN IF NOT EXISTS transitioned_at timestamptz;

-- ── 2. Per-user notification inbox ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         text NOT NULL,
  -- 'child_turning_18_7d'   – parent warned 7 days before child turns 18
  -- 'child_turned_18'       – parent notified on child's 18th birthday
  -- 'child_transitioned'    – parent notified that child was moved to non-member status
  title        text NOT NULL,
  body         text NOT NULL,
  child_id     uuid REFERENCES children(id) ON DELETE CASCADE,
  read_at      timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE member_notifications ENABLE ROW LEVEL SECURITY;

-- Users may only read their own notifications
CREATE POLICY "own_notifications_select"
  ON member_notifications FOR SELECT
  USING (auth.uid() = profile_id);

-- Users may only update their own notifications (to set read_at / dismissed_at)
CREATE POLICY "own_notifications_update"
  ON member_notifications FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Fast look-up for the welcome-tab query (active = not yet dismissed)
CREATE INDEX IF NOT EXISTS member_notifications_profile_active
  ON member_notifications (profile_id, dismissed_at)
  WHERE dismissed_at IS NULL;

-- ── 3. pg_cron registration ───────────────────────────────────────────────────
-- Deploy supabase/functions/check-age-transitions first, then run this block.
-- Fires daily at 9:00 AM UTC (≈ 3–4 AM Central / Winnipeg time).
-- Replace <service_role_key> with the value from Supabase → Settings → API.
--
-- SELECT cron.schedule(
--   'check-age-transitions',
--   '0 9 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://lkmphayrithxkmhvfiep.supabase.co/functions/v1/check-age-transitions',
--       headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}'::jsonb,
--       body    := '{}'::jsonb
--     )
--   $$
-- );
--
-- Verify with:  SELECT * FROM cron.job WHERE jobname = 'check-age-transitions';
