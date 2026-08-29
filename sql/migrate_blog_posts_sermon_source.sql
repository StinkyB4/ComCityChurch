-- ============================================================
-- SERMON → BLOG AUTOMATION
-- Adds the idempotency key the weekly job uses to avoid
-- drafting the same sermon twice.
-- Run this in the Supabase SQL editor for your project.
-- ============================================================

alter table blog_posts
  add column if not exists source_file_id text;

-- One post per source recording. Partial index so the many
-- hand-written posts (source_file_id is null) don't collide.
create unique index if not exists blog_posts_source_file_id_key
  on blog_posts (source_file_id)
  where source_file_id is not null;

-- No new RLS policy is needed: the automation authenticates with the
-- service_role key, which bypasses row level security entirely. Every
-- existing policy continues to govern browser and member-portal access.
