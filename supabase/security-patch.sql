-- ============================================================================
-- COMMISSIONED CITY CHURCH — SECURITY PATCH
-- ============================================================================
-- Resolves all ERRORs and WARNs from the Supabase database linter.
-- Safe to re-run (uses OR REPLACE, IF EXISTS, ON CONFLICT DO NOTHING).
--
-- After applying, re-run the Supabase linter to confirm all issues are cleared.
-- One item requires manual action — see note at the bottom.
-- ============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- 1. FIX: profiles_approved view — SECURITY DEFINER → SECURITY INVOKER
-- The view should use the querying user's RLS context, not the creator's.
-- ──────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.profiles_approved;
CREATE VIEW public.profiles_approved
  WITH (security_invoker = true)
  AS SELECT * FROM profiles WHERE status = 'approved';


-- ──────────────────────────────────────────────────────────────────────────
-- 2. FIX: children table — ensure RLS is enabled
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. FIX: swap_tokens — enable RLS, revoke broad anon access
-- The edge function uses the service role key which bypasses RLS entirely,
-- so enabling RLS here does not break the swap-token edge function.
-- ──────────────────────────────────────────────────────────────────────────

REVOKE SELECT, INSERT, DELETE ON public.swap_tokens FROM anon;

ALTER TABLE public.swap_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swap_tokens' AND policyname = 'admins_manage_swap_tokens'
  ) THEN
    CREATE POLICY "admins_manage_swap_tokens"
      ON public.swap_tokens FOR ALL
      USING (public.is_admin());
  END IF;
END$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 4. FIX: mutable search_path — functions we have source for
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- handle_new_user: extended v2 version with all registration fields
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


-- ──────────────────────────────────────────────────────────────────────────
-- 5. FIX: mutable search_path — functions without local source
-- Uses ALTER FUNCTION to add SET search_path without touching the body.
-- ──────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.link_spouses(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.unlink_spouses(uuid) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.rls_auto_enable() SET search_path = public;
ALTER FUNCTION public.save_children(uuid, jsonb) SET search_path = public;


-- ──────────────────────────────────────────────────────────────────────────
-- 6. FIX: revoke EXECUTE on SECURITY DEFINER functions from anon / authenticated
--
-- Supabase auto-grants EXECUTE to anon+authenticated on all public functions
-- via ALTER DEFAULT PRIVILEGES. A plain REVOKE ON FUNCTION gets overridden
-- when the function is recreated. The reliable fix is:
--   1. REVOKE FROM PUBLIC (removes all roles at once, including the default grant)
--   2. Re-grant selectively to authenticated where the function is legitimately
--      callable by signed-in users.
--
-- What each function needs:
--   handle_new_user  — trigger only; no role should call it via RPC
--   is_admin         — authenticated may call (useful RPC); block anon
--   is_approved_member — authenticated may call; block anon
--   link_spouses     — authenticated members call this; block anon
--   unlink_spouses   — authenticated members call this; block anon
--   rls_auto_enable  — internal utility; no role should call via RPC
--   save_children    — authenticated members call this; block anon
-- ──────────────────────────────────────────────────────────────────────────

-- Step 1: revoke from all roles (including the implicit public grant)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_approved_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_spouses(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unlink_spouses(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_children(uuid, jsonb) FROM PUBLIC;

-- Step 2: re-grant to authenticated where the RPC is intentional
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_spouses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_spouses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_children(uuid, jsonb) TO authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 7. FIX: blog-images bucket — drop broad SELECT policy that allows listing
-- Images in a public bucket are accessible via direct CDN URL without a
-- PostgREST SELECT policy. Dropping it prevents API-based file listing.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone reads blog images" ON storage.objects;


-- ──────────────────────────────────────────────────────────────────────────
-- MANUAL ACTION REQUIRED
-- ──────────────────────────────────────────────────────────────────────────
-- Leaked password protection cannot be enabled via SQL.
-- Enable it in the Supabase dashboard:
--   Auth → Settings → Password → "Leaked password protection (HaveIBeenPwned)"
-- ──────────────────────────────────────────────────────────────────────────
