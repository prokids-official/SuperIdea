create or replace function app_private.is_allowed_signup(email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select true;
$$;
