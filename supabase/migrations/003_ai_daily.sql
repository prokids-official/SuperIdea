create table if not exists public.ai_daily_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number integer not null unique,
  title text not null,
  issue_date date not null,
  content_markdown text not null default '',
  url text not null,
  source text not null default 'GitHub Issues',
  summary jsonb not null default '{}'::jsonb,
  relevance_tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_daily_issues_date_idx
  on public.ai_daily_issues(issue_date desc);

alter table public.ai_daily_issues enable row level security;

drop policy if exists "ai daily read authenticated" on public.ai_daily_issues;
create policy "ai daily read authenticated"
  on public.ai_daily_issues
  for select
  to authenticated
  using (true);

grant select on public.ai_daily_issues to authenticated;
