-- ============================================================
-- LINK PAGE (/links) — Supabase Setup
-- Run this once in the Supabase SQL editor for your project.
--
-- Backs the admin editor at /members/admin → "Link Page".
-- The public page falls back to the static markup in links.html
-- if these tables are missing or unreachable, so running this
-- late (or not at all) never takes the page down.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SETTINGS  (exactly one row, id = 1)
-- ------------------------------------------------------------
create table if not exists link_page_settings (
  id              smallint primary key default 1 check (id = 1),

  -- header
  headline        text    not null default 'Commissioned City Church',
  tagline         text    not null default 'For the Good of the City · For the Glory of Christ',
  logo_url        text    not null default '/assets/logo.png',
  logo_size       int     not null default 180 check (logo_size between 80 and 320),
  logo_plate      boolean not null default true,

  -- background
  bg_type         text    not null default 'color' check (bg_type in ('color', 'image')),
  bg_color        text    not null default '#112E53',
  bg_image_url    text,
  bg_overlay      numeric not null default 0.45 check (bg_overlay between 0 and 1),

  -- buttons
  btn_color       text    not null default '#FFFFFF',
  btn_text_color  text    not null default '#112E53',
  btn_style       text    not null default 'solid' check (btn_style in ('solid', 'outline')),
  btn_radius      int     not null default 999 check (btn_radius between 0 and 999),

  -- text
  font_color      text    not null default '#FFFFFF',
  footer_text     text    not null default '© Commissioned City Church · Winnipeg, MB',

  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id) on delete set null
);

-- Seed the single row.
insert into link_page_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. LINKS  (buttons and social icons)
-- ------------------------------------------------------------
create table if not exists link_page_links (
  id          uuid    primary key default gen_random_uuid(),
  kind        text    not null default 'button' check (kind in ('button', 'social')),

  -- buttons: a sprite name from links.html section 8, e.g. 'icon-pin'
  -- socials: a platform name, e.g. 'instagram'
  icon        text    not null default '',

  label       text    not null default '',   -- buttons: big line. socials: aria-label
  sublabel    text    not null default '',   -- buttons only, optional
  url         text    not null default '',
  sort_order  int     not null default 0,
  is_visible  boolean not null default true,
  new_tab     boolean not null default false,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists link_page_links_order_idx
  on link_page_links (kind, sort_order);

-- ------------------------------------------------------------
-- 3. UPDATED_AT triggers
--    (update_updated_at_column() already exists from the blog
--     setup; created here too so this file stands alone.)
-- ------------------------------------------------------------
create or replace function update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists link_page_settings_updated_at on link_page_settings;
create trigger link_page_settings_updated_at
  before update on link_page_settings
  for each row execute procedure update_updated_at_column();

drop trigger if exists link_page_links_updated_at on link_page_links;
create trigger link_page_links_updated_at
  before update on link_page_links
  for each row execute procedure update_updated_at_column();

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Public may read. Only approved admins may write.
-- ------------------------------------------------------------
alter table link_page_settings enable row level security;
alter table link_page_links    enable row level security;

-- Anyone can read the settings row — it is public page styling.
drop policy if exists "Public reads link page settings" on link_page_settings;
create policy "Public reads link page settings"
  on link_page_settings for select
  to anon, authenticated
  using (true);

-- Anyone can read visible links. Hidden ones stay out of the API for
-- the public, so an unfinished link is not discoverable before launch.
drop policy if exists "Public reads visible links" on link_page_links;
create policy "Public reads visible links"
  on link_page_links for select
  to anon, authenticated
  using (is_visible);

-- Admins read everything, including hidden links.
drop policy if exists "Admins read all links" on link_page_links;
create policy "Admins read all links"
  on link_page_links for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- Admins write. Settings is update-only: the single row is seeded above
-- and there is deliberately no insert or delete policy for it.
drop policy if exists "Admins update link page settings" on link_page_settings;
create policy "Admins update link page settings"
  on link_page_settings for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

drop policy if exists "Admins insert links" on link_page_links;
create policy "Admins insert links"
  on link_page_links for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

drop policy if exists "Admins update links" on link_page_links;
create policy "Admins update links"
  on link_page_links for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

drop policy if exists "Admins delete links" on link_page_links;
create policy "Admins delete links"
  on link_page_links for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- ------------------------------------------------------------
-- 5. STORAGE for background images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('link-page', 'link-page', true)
on conflict (id) do nothing;

drop policy if exists "Admins upload link page images" on storage.objects;
create policy "Admins upload link page images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'link-page'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin' and status = 'approved'
    )
  );

-- No SELECT policy: objects in a public bucket are served over their direct
-- CDN URL without one, and omitting it stops clients listing the bucket.

-- ------------------------------------------------------------
-- 6. SEED the five launch buttons and the two live socials.
--    Matches the static fallback markup in links.html, so turning
--    the database on does not change what visitors see.
-- ------------------------------------------------------------
insert into link_page_links (kind, icon, label, sublabel, url, sort_order, is_visible, new_tab)
select * from (values
  ('button', 'icon-people',     'Get Connected', 'Say hello and we''ll be in touch',      '/contact',     1, true,  false),
  ('button', 'icon-pin',        'Plan a Visit',  'What to expect on your first Sunday',   '/visit',       2, true,  false),
  ('button', 'icon-steps',      'First Steps',   'New to faith or new to us? Start here', '/first-steps', 3, true,  false),
  ('button', 'icon-headphones', 'Sermons',       'Listen to the latest teaching',         '/sermons',     4, true,  false),
  ('button', 'icon-book',       'The Gospel',    'The best news you''ll ever hear',       '/gospel',      5, true,  false),
  ('social', 'spotify',         'Sermons on Spotify', '', 'https://open.spotify.com/show/2XGMvfMPl2GVUDEkHG5GTZ', 1, true, true),
  ('social', 'mail',            'Email us',           '', 'mailto:info@commissionedcity.church',                  2, true, false)
) as seed(kind, icon, label, sublabel, url, sort_order, is_visible, new_tab)
where not exists (select 1 from link_page_links);
