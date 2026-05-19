create table if not exists public.tracked_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube', 'tiktok', 'douyin', 'bilibili', 'xiaohongshu')),
  display_name text not null,
  handle text,
  homepage_url text,
  query_hint text,
  category text not null default 'children_content',
  enabled boolean not null default true,
  scrape_interval_days integer not null default 3 check (scrape_interval_days between 1 and 30),
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, display_name)
);

create table if not exists public.tracked_videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.tracked_accounts(id) on delete set null,
  platform text not null check (platform in ('youtube', 'tiktok', 'douyin', 'bilibili', 'xiaohongshu')),
  external_id text,
  title text not null,
  url text not null,
  thumbnail_url text,
  description text,
  creator_name text,
  published_at timestamptz,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  duration text,
  data_source text,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform, url)
);

create index if not exists tracked_accounts_due_idx
  on public.tracked_accounts(enabled, next_check_at);

create index if not exists tracked_videos_platform_published_idx
  on public.tracked_videos(platform, published_at desc nulls last);

create index if not exists tracked_videos_account_seen_idx
  on public.tracked_videos(account_id, last_seen_at desc);

alter table public.tracked_accounts enable row level security;
alter table public.tracked_videos enable row level security;

drop policy if exists "tracked accounts read authenticated" on public.tracked_accounts;
drop policy if exists "tracked videos read authenticated" on public.tracked_videos;

create policy "tracked accounts read authenticated"
  on public.tracked_accounts
  for select
  to authenticated
  using (true);

create policy "tracked videos read authenticated"
  on public.tracked_videos
  for select
  to authenticated
  using (true);

grant select on public.tracked_accounts to authenticated;
grant select on public.tracked_videos to authenticated;

grant select, insert, update, delete on public.tracked_accounts to service_role;
grant select, insert, update, delete on public.tracked_videos to service_role;

insert into public.tracked_accounts (platform, display_name, handle, homepage_url, query_hint, category, notes)
values
  ('youtube', 'BabyBus', '@BabyBus', 'https://www.youtube.com/@BabyBus', 'BabyBus nursery rhymes latest', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Bebefinn', '@Bebefinn', 'https://www.youtube.com/@Bebefinn', 'Bebefinn nursery rhymes latest', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Pinkfong', '@Pinkfong', 'https://www.youtube.com/@Pinkfong', 'Pinkfong latest songs animation', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Babyshark', '@BabyShark', 'https://www.youtube.com/@BabyShark', 'Baby Shark official latest songs', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Doko Demo Jamboree', '@DokoDemoJamboree', 'https://www.youtube.com/@DokoDemoJamboree', 'Doko Demo Jamboree latest', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Super Simple Songs', '@SuperSimpleSongs', 'https://www.youtube.com/@SuperSimpleSongs', 'Super Simple Songs latest', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', '贝乐虎', '@Beilehu', 'https://www.youtube.com/@Beilehu', '贝乐虎 儿歌 latest', 'children_content', 'YouTube fixed competitor account'),
  ('youtube', 'Doggyland', '@DoggylandKidsSongs', 'https://www.youtube.com/@DoggylandKidsSongs', 'Doggyland Kids Songs latest', 'children_content', 'YouTube fixed competitor account'),
  ('tiktok', 'Pinkfong', '@pinkfong_official', 'https://www.tiktok.com/@pinkfong_official', 'site:tiktok.com/@pinkfong_official Pinkfong', 'children_content', 'TikTok fixed competitor account'),
  ('tiktok', 'Babyshark', '@babyshark_brooklyn', 'https://www.tiktok.com/@babyshark_brooklyn', 'site:tiktok.com/@babyshark_brooklyn Babyshark', 'children_content', 'TikTok fixed competitor account'),
  ('tiktok', 'Doko Demo Jamboree', '@dokojam', 'https://www.tiktok.com/@dokojam', 'site:tiktok.com/@dokojam Doko Demo Jamboree', 'children_content', 'TikTok fixed competitor account'),
  ('tiktok', 'Super Simple Songs', '@supersimpleofficial', 'https://www.tiktok.com/@supersimpleofficial', 'site:tiktok.com/@supersimpleofficial Super Simple Songs', 'children_content', 'TikTok fixed competitor account'),
  ('douyin', '周鸿祎（红衣大叔）', null, 'https://www.douyin.com/user/MS4wLjABAAAAJ3T5moYwIGWeicRl5wBdfosV7R_dCmIbcmAIVZ_3iLK3aLLrOq9pWQDaZBfU0kpQ?from_tab_name=main', 'site:douyin.com/user 周鸿祎 红衣大叔 抖音', 'ai_business', 'Douyin fixed account'),
  ('douyin', '洋过探世界', null, 'https://www.douyin.com/user/MS4wLjABAAAA4_Z4azV9QXsPV42NWF9B9IeFOgYCI9OXrIUeHftx0TwfCQPvKiq9Dz-PxBkhl2LB?from_tab_name=main', 'site:douyin.com/user 洋过探世界 抖音', 'content_reference', 'Douyin fixed account'),
  ('douyin', '小五狼', null, 'https://www.douyin.com/user/MS4wLjABAAAAaEO1djQykbPFCAX_QtSVBmULgfRMW_txc5z-_3FfBMY?from_tab_name=main', 'site:douyin.com/user 小五狼 抖音', 'content_reference', 'Douyin fixed account'),
  ('douyin', '贝乐虎儿歌', null, 'https://www.douyin.com/user/MS4wLjABAAAAoJtQs2kZmNRkpgdJ5bqiGo5Tew1SpfraM4w_E7511HQ?from_tab_name=main', 'site:douyin.com/user 贝乐虎儿歌 抖音', 'children_content', 'Douyin fixed competitor account'),
  ('douyin', '儿歌多多', null, 'https://www.douyin.com/user/MS4wLjABAAAA4DXjHfG0tltAUoX86re-41hAocOY2MguXcrL-ZZDYrU?from_tab_name=main', 'site:douyin.com/user 儿歌多多 抖音', 'children_content', 'Douyin fixed competitor account')
on conflict (platform, display_name) do update
set
  handle = excluded.handle,
  homepage_url = excluded.homepage_url,
  query_hint = excluded.query_hint,
  category = excluded.category,
  notes = excluded.notes,
  updated_at = now();
