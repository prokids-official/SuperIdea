-- 芝兰点子王 Supabase 初始结构
-- 在 Supabase SQL Editor 执行；所有 public 表开启 RLS。

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  avatar text not null default '内',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 120),
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'claimed', 'producing', 'published')),
  tags text[] not null default array['新点子']::text[],
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '内部账号',
  author_avatar text not null default '内',
  hot boolean not null default false,
  market jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idea_reactions (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id, kind)
);

create table if not exists public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '内部账号',
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_reactions enable row level security;
alter table public.idea_comments enable row level security;

drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "ideas read authenticated" on public.ideas;
create policy "ideas read authenticated"
on public.ideas for select
to authenticated
using (true);

drop policy if exists "ideas insert authenticated" on public.ideas;
create policy "ideas insert authenticated"
on public.ideas for insert
to authenticated
with check ((select auth.uid()) = author_id);

drop policy if exists "ideas update author" on public.ideas;
create policy "ideas update author"
on public.ideas for update
to authenticated
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);

drop policy if exists "reactions read authenticated" on public.idea_reactions;
create policy "reactions read authenticated"
on public.idea_reactions for select
to authenticated
using (true);

drop policy if exists "reactions manage self" on public.idea_reactions;
create policy "reactions manage self"
on public.idea_reactions for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "comments read authenticated" on public.idea_comments;
create policy "comments read authenticated"
on public.idea_comments for select
to authenticated
using (true);

drop policy if exists "comments insert authenticated" on public.idea_comments;
create policy "comments insert authenticated"
on public.idea_comments for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace view public.ideas_with_counts
with (security_invoker = true)
as
select
  i.*,
  count(r.*) filter (where r.kind = 'like')::int as likes,
  count(r.*) filter (where r.kind = 'save')::int as saves,
  count(c.*)::int as comments
from public.ideas i
left join public.idea_reactions r on r.idea_id = i.id
left join public.idea_comments c on c.idea_id = i.id
group by i.id;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.ideas to authenticated;
grant select, insert, delete on public.idea_reactions to authenticated;
grant select, insert on public.idea_comments to authenticated;
grant select on public.ideas_with_counts to authenticated;
