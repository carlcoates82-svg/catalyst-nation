-- Stores each user's email on their profile row so admins can look up (and
-- display) who's linked to a venture without needing the Auth Admin API —
-- PostgREST can't join against auth.users, but profiles is our own table.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_studio_admin, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', false, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
