-- ============================================================
-- BLOG POSTS — Supabase Setup
-- Run this in the Supabase SQL editor for your project.
-- ============================================================

-- 1. TABLE
create table if not exists blog_posts (
  id             uuid        default gen_random_uuid() primary key,
  author_id      uuid        references auth.users(id) on delete cascade,
  author_name    text        not null default '',
  title          text        not null default '',
  slug           text        unique not null,
  category       text        not null default '',
  excerpt        text        not null default '',
  content        text        not null default '',
  hero_image_url text,
  status         text        not null default 'draft',  -- draft | pending | published | scheduled
  publish_at     timestamptz,
  admin_note     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 2. UPDATED_AT trigger
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger blog_posts_updated_at
  before update on blog_posts
  for each row execute procedure update_updated_at_column();

-- 3. ROW LEVEL SECURITY
alter table blog_posts enable row level security;

-- Public can read published/scheduled-and-past posts
create policy "Public reads live posts"
  on blog_posts for select
  to anon, authenticated
  using (
    status = 'published'
    or (status = 'scheduled' and publish_at <= now())
  );

-- Authors can always read their own posts (any status)
create policy "Authors read own posts"
  on blog_posts for select
  to authenticated
  using (auth.uid() = author_id);

-- Admins can read all posts
create policy "Admins read all posts"
  on blog_posts for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- Leaders and admins can insert their own posts
create policy "Leaders and admins insert"
  on blog_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('team', 'admin')
      and status = 'approved'
    )
  );

-- Authors can update their own draft or pending posts
create policy "Authors update own drafts"
  on blog_posts for update
  to authenticated
  using (auth.uid() = author_id and status in ('draft', 'pending'))
  with check (auth.uid() = author_id and status in ('draft', 'pending'));

-- Admins can update any post
create policy "Admins update any post"
  on blog_posts for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- Authors delete own drafts; admins delete anything
create policy "Delete posts"
  on blog_posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- 4. STORAGE BUCKET
-- Run this in the Supabase dashboard → Storage → New bucket:
--   Name: blog-images
--   Public: true
-- Then add a policy: allow authenticated users to INSERT into blog-images
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "Authenticated users upload blog images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images');

create policy "Anyone reads blog images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'blog-images');
