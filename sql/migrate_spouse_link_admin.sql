-- ─────────────────────────────────────────────────────────────────────────────
-- SPOUSE LINKING — ADMIN-CAPABLE link_spouses() / unlink_spouses()
--
-- The admin member editor had no way to LINK two members as spouses: the only
-- linking UI lived in a member's own profile, so an admin fixing up a family
-- had to log in as that member. This migration rewrites both RPCs so an admin
-- can link/unlink any two profiles, while a member can still only touch a link
-- that involves themselves.
--
-- Both functions are SECURITY DEFINER (they write both sides of the link, which
-- RLS would otherwise block — a member may only update their own row), so they
-- do their own authorization:
--   • public.is_admin()                → may link/unlink anyone
--   • auth.uid() IN (p_user_a, p_user_b) → a member may link/unlink themselves
--
-- link_spouses() also writes BOTH rows' spouse_id. Historically only one side
-- was populated, which is why so much of the client code has to check the link
-- in both directions; new links written here are symmetric.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── link_spouses(a, b) ──────────────────────────────────────────────────────
-- Links two profiles as spouses. Raises (rather than silently no-ops) when the
-- link is impossible, so the client can surface a real message.
-- The live version of these functions was created ad-hoc in the Supabase editor
-- and its return type isn't recorded anywhere in this repo; Postgres refuses to
-- change a return type via CREATE OR REPLACE, so drop first (same reason
-- migrate_children_rpc.sql drops save_children).
DROP FUNCTION IF EXISTS public.link_spouses(uuid, uuid);

CREATE FUNCTION public.link_spouses(p_user_a uuid, p_user_b uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a_existing uuid;
  v_b_existing uuid;
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL THEN
    RAISE EXCEPTION 'Both profiles are required to link a couple.';
  END IF;

  IF p_user_a = p_user_b THEN
    RAISE EXCEPTION 'A member cannot be linked to themselves.';
  END IF;

  /* COALESCE so an unauthenticated auth.uid() (NULL) fails closed rather than
     making the whole condition NULL, which IF treats as "not true" */
  IF NOT COALESCE(public.is_admin() OR auth.uid() IN (p_user_a, p_user_b), false) THEN
    RAISE EXCEPTION 'Not authorized to link these profiles.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_a)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_b) THEN
    RAISE EXCEPTION 'One of these profiles no longer exists.';
  END IF;

  /* existing link for each side, checking both directions — a one-sided link
     from an older save still counts as "already married to someone" */
  SELECT COALESCE(
           (SELECT spouse_id FROM public.profiles WHERE id = p_user_a),
           (SELECT id FROM public.profiles WHERE spouse_id = p_user_a LIMIT 1)
         ) INTO v_a_existing;
  SELECT COALESCE(
           (SELECT spouse_id FROM public.profiles WHERE id = p_user_b),
           (SELECT id FROM public.profiles WHERE spouse_id = p_user_b LIMIT 1)
         ) INTO v_b_existing;

  IF v_a_existing IS NOT NULL AND v_a_existing <> p_user_b THEN
    RAISE EXCEPTION 'That member is already linked to another spouse.';
  END IF;
  IF v_b_existing IS NOT NULL AND v_b_existing <> p_user_a THEN
    RAISE EXCEPTION 'That member is already linked to another spouse.';
  END IF;

  /* write both sides so the link is symmetric from the start */
  UPDATE public.profiles
     SET spouse_id        = p_user_b,
         spouse_is_member = true,
         spouse_name_text = NULL
   WHERE id = p_user_a;

  UPDATE public.profiles
     SET spouse_id        = p_user_a,
         spouse_is_member = true,
         spouse_name_text = NULL
   WHERE id = p_user_b;
END;
$$;

-- ── unlink_spouses(uid) ─────────────────────────────────────────────────────
-- Clears the link from both sides, whichever side it was stored on.
DROP FUNCTION IF EXISTS public.unlink_spouses(uuid);

CREATE FUNCTION public.unlink_spouses(p_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_spouse uuid;
BEGIN
  IF p_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(
           (SELECT spouse_id FROM public.profiles WHERE id = p_uid),
           (SELECT id FROM public.profiles WHERE spouse_id = p_uid LIMIT 1)
         ) INTO v_spouse;

  IF NOT COALESCE(public.is_admin() OR auth.uid() = p_uid OR auth.uid() = v_spouse, false) THEN
    RAISE EXCEPTION 'Not authorized to unlink these profiles.';
  END IF;

  UPDATE public.profiles
     SET spouse_id = NULL, spouse_is_member = false
   WHERE id = p_uid OR id = v_spouse OR spouse_id = p_uid;
END;
$$;

-- Supabase auto-grants EXECUTE on public functions to anon+authenticated, and
-- that default grant comes back every time a function is recreated — so revoke
-- and re-grant selectively (same pattern as supabase/security-patch.sql).
REVOKE EXECUTE ON FUNCTION public.link_spouses(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unlink_spouses(uuid)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_spouses(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.unlink_spouses(uuid)     TO authenticated;
