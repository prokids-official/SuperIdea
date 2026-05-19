create schema if not exists app_private;

alter table public.profiles
  add column if not exists role text not null default 'member'
  check (role in ('admin', 'member'));

create table if not exists public.signup_allowlist (
  email text primary key,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.signup_allowlist enable row level security;

update public.profiles
set role = 'admin'
where lower(email) = 'loy27felix@gmail.com';

insert into public.signup_allowlist (email, note)
values ('loy27felix@gmail.com', 'default admin')
on conflict (email) do nothing;

drop policy if exists "signup allowlist read admin" on public.signup_allowlist;
create policy "signup allowlist read admin"
  on public.signup_allowlist
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "signup allowlist insert admin" on public.signup_allowlist;
create policy "signup allowlist insert admin"
  on public.signup_allowlist
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "signup allowlist delete admin" on public.signup_allowlist;
create policy "signup allowlist delete admin"
  on public.signup_allowlist
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (true);

create or replace function app_private.is_allowed_signup(email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(email) = 'loy27felix@gmail.com'
    or lower(email) like '%@beva.com'
    or exists (
      select 1
      from public.signup_allowlist a
      where lower(a.email) = lower(is_allowed_signup.email)
    );
$$;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text;
  display_avatar text;
  user_role text := 'member';
begin
  if not app_private.is_allowed_signup(normalized_email) then
    raise exception 'Only @beva.com emails or admin-invited emails can register.';
  end if;

  if normalized_email = 'loy27felix@gmail.com' then
    user_role := 'admin';
  end if;

  display_name := split_part(normalized_email, '@', 1);
  if display_name = '' then
    display_name := '内部账号';
  end if;
  display_avatar := upper(left(display_name, 1));
  if display_avatar = '' then
    display_avatar := '内';
  end if;

  insert into public.profiles (id, email, name, avatar, role)
  values (new.id, normalized_email, display_name, display_avatar, user_role)
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when lower(excluded.email) = 'loy27felix@gmail.com' then 'admin'
          else public.profiles.role
        end,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_zhilan on auth.users;
create trigger on_auth_user_created_zhilan
  after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

grant select, insert, delete on public.signup_allowlist to authenticated;
