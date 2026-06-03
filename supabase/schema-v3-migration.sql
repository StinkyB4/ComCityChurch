-- ============================================================================
-- COMMISSIONED CITY CHURCH — MEMBERS PORTAL v3 MIGRATION
-- ============================================================================
-- Run this AFTER schema-v2-migration.sql.
-- Safe to re-run (uses ADD COLUMN IF NOT EXISTS).
--
-- What this adds:
--   • profile_reminder_dismissed flag on profiles
--     Tracks whether the user has acknowledged the "complete your profile"
--     reminder on the welcome tab (spouse linking + children prompts).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_reminder_dismissed BOOLEAN DEFAULT false;
