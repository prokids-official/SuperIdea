create table if not exists public.content_search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  platforms text[] not null default array['web'],
  sort text not null default 'hot',
  time_range text not null default '7d',
  limit_count integer not null default 12 check (limit_count between 1 and 50),
  include_ai_brief boolean not null default true,
  fetch_top integer not null default 3 check (fetch_top between 0 and 5),
  ai_brief_top integer not null default 5 check (ai_brief_top between 0 and 10),
  brief_mode text not null default 'auto',
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  source_status jsonb not null default '{}'::jsonb,
  elapsed_ms integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.content_search_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.content_search_jobs(id) on delete cascade,
  rank integer not null,
  platform text not null,
  title text not null,
  url text not null,
  description text,
  creator_name text,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  published_at timestamptz,
  duration text,
  data_source text,
  brief_source text,
  brief_model text,
  ai_brief jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_search_jobs_status_created_idx
  on public.content_search_jobs(status, created_at);

create index if not exists content_search_jobs_user_created_idx
  on public.content_search_jobs(user_id, created_at desc);

create index if not exists content_search_results_job_rank_idx
  on public.content_search_results(job_id, rank);

alter table public.content_search_jobs enable row level security;
alter table public.content_search_results enable row level security;

drop policy if exists "search jobs read authenticated" on public.content_search_jobs;
drop policy if exists "search jobs insert authenticated" on public.content_search_jobs;
drop policy if exists "search jobs update own queued" on public.content_search_jobs;
drop policy if exists "search results read authenticated" on public.content_search_results;

create policy "search jobs read authenticated"
  on public.content_search_jobs
  for select
  to authenticated
  using (true);

create policy "search jobs insert authenticated"
  on public.content_search_jobs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "search jobs update own queued"
  on public.content_search_jobs
  for update
  to authenticated
  using (auth.uid() = user_id and status = 'queued')
  with check (auth.uid() = user_id);

create policy "search results read authenticated"
  on public.content_search_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.content_search_jobs jobs
      where jobs.id = content_search_results.job_id
    )
  );

grant select, insert, update on public.content_search_jobs to authenticated;
grant select on public.content_search_results to authenticated;
