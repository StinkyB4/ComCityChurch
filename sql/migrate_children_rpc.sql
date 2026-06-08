-- ─────────────────────────────────────────────────────────────────────────────
-- CHILDREN — ATOMIC SAVE + SPOUSE-SHARED VISIBILITY  (schema-v6)
--
-- Replaces the unsafe client-side "delete every row, then re-insert" save
-- pattern (two separate network calls — if the second one fails for ANY
-- reason, every one of that family's children is already gone with nothing
-- to replace it) with a single atomic, server-side RPC. Also replaces the
-- "mirror rows to both spouses" approach (which is what produced the
-- recurring RLS violation: it inserted rows with profile_id = the SPOUSE's
-- id while authenticated as the original user) with one canonical row-set
-- that both linked spouses can see — no duplication, no sync drift.
--
-- Run once in the Supabase SQL editor, AFTER migrate_age_transitions.sql.
-- Safe to re-run (CREATE OR REPLACE / IF EXISTS / IF NOT EXISTS throughout).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. profiles.child_notif_optout ───────────────────────────────────────────
-- Referenced throughout js/dashboard.js and send-reminders/index.ts but never
-- captured in a committed migration (it was added directly in the dashboard
-- at some point). Adding it here so the committed schema matches what's live.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS child_notif_optout boolean DEFAULT false;


-- ── 1. is_my_spouse() helper ──────────────────────────────────────────────────
-- True when `target` is linked to the calling user as a spouse, checking both
-- directions of the link (profiles.spouse_id is only populated on one side).
CREATE OR REPLACE FUNCTION public.is_my_spouse(target uuid)
RETURNS boolean LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (id = auth.uid() AND spouse_id = target)
       OR (id = target     AND spouse_id = auth.uid())
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_my_spouse(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_spouse(uuid) TO authenticated;


-- ── 2. Rebuild children RLS around a single RPC write-path ──────────────────
-- Drop every children policy this project has accumulated across migration
-- attempts (some of which actively conflicted) and start from a clean,
-- documented set:
--   • SELECT — you, your linked spouse, any approved member (directory), or admin
--   • INSERT/UPDATE/DELETE — NOT exposed to members at all. Every write goes
--     through save_children() below, which is SECURITY DEFINER (bypasses RLS
--     after doing its own authorization + canonical-owner + diff logic). This
--     makes "half-saved" states structurally impossible — there is no longer
--     any direct path for a client to delete rows without replacing them.
DROP POLICY IF EXISTS "members_view_own_children"   ON public.children;
DROP POLICY IF EXISTS "members_view_all_children"   ON public.children;
DROP POLICY IF EXISTS "members_manage_own_children" ON public.children;
DROP POLICY IF EXISTS "admins_manage_all_children"  ON public.children;
DROP POLICY IF EXISTS "members_insert_own_children" ON public.children;
DROP POLICY IF EXISTS "members_delete_own_children" ON public.children;

CREATE POLICY "view_own_spouse_or_member_children"
  ON public.children FOR SELECT
  USING (
    profile_id = auth.uid()
    OR public.is_my_spouse(profile_id)
    OR public.is_approved_member()
  );

CREATE POLICY "admins_manage_all_children"
  ON public.children FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No member-facing write grants — see save_children() for the only write path.
REVOKE INSERT, UPDATE, DELETE ON public.children FROM authenticated;


-- ── 3. save_children() — single atomic save (replaces the undocumented version) ──
-- One PL/pgSQL function body runs as one transaction: if anything raises
-- partway through, Postgres rolls back the entire call and the existing rows
-- are left exactly as they were — there is no "deleted but not re-inserted"
-- state possible.
--
-- p_children is a jsonb array of {id?, name, gender, birthday}:
--   • items WITH an existing id are updated in place — this preserves the
--     foreign keys that point at a child row (team_members.child_id,
--     member_notifications.child_id, and the age-18 transition_state /
--     turned_18_at / transitioned_at columns), so editing a child's birthday
--     never orphans their roster history or resets their transition clock
--   • items WITHOUT an id are inserted as new rows
--   • existing rows whose id is no longer present in the list are deleted
--
-- Canonical-owner resolution: if either spouse already has rows, the save
-- continues to use that profile_id, so the list can never fork into two
-- divergent copies regardless of which spouse is editing.
CREATE OR REPLACE FUNCTION public.save_children(p_profile_id uuid, p_children jsonb)
RETURNS SETOF public.children
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner  uuid;
  v_spouse uuid;
BEGIN
  IF p_profile_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_my_spouse(p_profile_id)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized to manage children for this profile';
  END IF;

  SELECT COALESCE(
           (SELECT spouse_id FROM public.profiles WHERE id = p_profile_id),
           (SELECT id        FROM public.profiles WHERE spouse_id = p_profile_id)
         ) INTO v_spouse;

  SELECT c.profile_id INTO v_owner
    FROM public.children c
   WHERE c.profile_id = p_profile_id
      OR (v_spouse IS NOT NULL AND c.profile_id = v_spouse)
   LIMIT 1;
  v_owner := COALESCE(v_owner, p_profile_id);

  DELETE FROM public.children
   WHERE profile_id = v_owner
     AND NOT (id = ANY (
       SELECT (elem->>'id')::uuid
         FROM jsonb_array_elements(COALESCE(p_children, '[]'::jsonb)) elem
        WHERE elem ? 'id' AND NULLIF(elem->>'id','') IS NOT NULL
     ));

  INSERT INTO public.children (id, profile_id, name, gender, birthday)
  SELECT COALESCE(NULLIF(elem->>'id','')::uuid, gen_random_uuid()),
         v_owner,
         elem->>'name',
         COALESCE(NULLIF(elem->>'gender',''), 'boy'),
         NULLIF(elem->>'birthday','')::date
    FROM jsonb_array_elements(COALESCE(p_children, '[]'::jsonb)) elem
   WHERE COALESCE(elem->>'name','') <> ''
  ON CONFLICT (id) DO UPDATE
     SET name     = EXCLUDED.name,
         gender   = EXCLUDED.gender,
         birthday = EXCLUDED.birthday;

  RETURN QUERY SELECT * FROM public.children WHERE profile_id = v_owner ORDER BY created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_children(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_children(uuid, jsonb) TO authenticated;
