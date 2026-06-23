-- ============================================================================
-- COMMISSIONED CITY CHURCH — MEMBERS PORTAL v5 MIGRATION
-- ============================================================================
-- Run this AFTER schema-v4-migration.sql.
--
-- What this adds:
--   • Hardened profiles DELETE policy — admins may delete members and team
--     leaders, but NOT admin accounts (their own or anyone else's).
--
-- Why:
--   The portal UI already blocks deleting admin accounts, but that guard lives
--   in the browser. A user with console/API access could call the Supabase
--   client directly and bypass it. Those calls run under the logged-in user's
--   JWT (the `authenticated` role), which RLS governs — so enforcing the rule
--   here makes it tamper-proof against the browser path.
--
-- Escape hatch (intentional):
--   To genuinely remove an admin, first change their role to 'member' or
--   'team' (then this policy permits the delete), OR delete the underlying
--   auth.users row via the service role / admin API. Service-role operations
--   bypass RLS, so the legitimate backend delete path is unaffected, and the
--   auth.users → profiles ON DELETE CASCADE still works.
--
-- Note: RLS DELETE rules are filters, not errors. An attempt to delete an
--   admin row simply removes 0 rows (no exception). The UI's own guard already
--   surfaces a friendly message before it ever reaches this point.
-- ============================================================================

-- Replace the original "any admin may delete any profile" policy with one that
-- excludes admin-role rows from deletion. The USING expression is evaluated
-- against each row being deleted, so `role <> 'admin'` protects every admin
-- account, including the caller's own.
DROP POLICY IF EXISTS "admins_delete_profiles"           ON profiles;
DROP POLICY IF EXISTS "admins_delete_non_admin_profiles" ON profiles;

CREATE POLICY "admins_delete_non_admin_profiles"
  ON profiles FOR DELETE
  USING (public.is_admin() AND role <> 'admin');
