-- Catalyst Nation — initial schema + multi-tenant RLS
-- Run this once in the Supabase SQL editor on a fresh project.
-- Mirrors the domain model in Catalyst Nation-os-mcp/src/db.ts, translated to
-- Postgres and extended with profiles/venture_members for per-venture access.

-- ---------------------------------------------------------------------------
-- Domain tables
-- ---------------------------------------------------------------------------

create table if not exists public.ventures (
  id bigint generated always as identity primary key,
  name text not null,
  sector text,
  thesis text,
  buyer text,
  founder_ceo text,
  stage text not null default 'Discover'
    check (stage in ('Discover','Validate','Design','Build','Pilot','Prove','Launch','Scale')),
  status text not null default 'active'
    check (status in ('active','paused','killed','launched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gates (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  stage text not null,
  decision text not null check (decision in ('proceed','hold','kill')),
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists gates_venture_id_idx on public.gates(venture_id);

create table if not exists public.validation (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  kind text not null check (kind in ('interview','willingness-to-pay','pilot-signal','competitor','other')),
  note text not null,
  willingness_to_pay numeric,
  created_at timestamptz not null default now()
);
create index if not exists validation_venture_id_idx on public.validation(venture_id);

create table if not exists public.budgets (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  phase text not null check (phase in ('validation','mvp','pilot','other')),
  allocated numeric not null default 0,
  spent numeric not null default 0,
  currency text not null default 'EUR',
  unique (venture_id, phase)
);
create index if not exists budgets_venture_id_idx on public.budgets(venture_id);

create table if not exists public.kpis (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  as_of date not null,
  arr numeric,
  customers integer,
  pipeline numeric,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists kpis_venture_id_idx on public.kpis(venture_id);

create table if not exists public.risks (
  id bigint generated always as identity primary key,
  venture_id bigint references public.ventures(id) on delete cascade,
  description text not null,
  severity text not null check (severity in ('low','medium','high')),
  likelihood text not null check (likelihood in ('low','medium','high')),
  owner text,
  mitigation text,
  status text not null default 'open' check (status in ('open','mitigating','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists risks_venture_id_idx on public.risks(venture_id);

-- ---------------------------------------------------------------------------
-- Identity / tenancy tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_studio_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.venture_members (
  venture_id bigint not null references public.ventures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ceo','admin')),
  created_at timestamptz not null default now(),
  primary key (venture_id, user_id)
);
create index if not exists venture_members_user_id_idx on public.venture_members(user_id);

-- Auto-create a profile row the moment someone signs up via Supabase Auth.
-- New profiles default to is_studio_admin = false; flip a specific user to
-- true directly in the SQL editor (see README) to grant studio-admin access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_studio_admin)
  values (new.id, new.raw_user_meta_data ->> 'full_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer so they can read profiles/
-- venture_members without being blocked by the RLS policies defined below)
-- ---------------------------------------------------------------------------

create or replace function public.is_studio_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_studio_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.member_venture_ids()
returns setof bigint
language sql
security definer
set search_path = public
stable
as $$
  select venture_id from public.venture_members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.ventures enable row level security;
alter table public.gates enable row level security;
alter table public.validation enable row level security;
alter table public.budgets enable row level security;
alter table public.kpis enable row level security;
alter table public.risks enable row level security;
alter table public.profiles enable row level security;
alter table public.venture_members enable row level security;

-- ventures: studio admins see everything; venture members see only their own.
create policy "ventures_select" on public.ventures for select
  using (public.is_studio_admin() or id in (select public.member_venture_ids()));
create policy "ventures_write_admin" on public.ventures for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

-- child tables scoped by venture_id, same read rule, admin-only writes for now.
create policy "gates_select" on public.gates for select
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));
create policy "gates_write_admin" on public.gates for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

create policy "validation_select" on public.validation for select
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));
create policy "validation_write_admin" on public.validation for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

create policy "budgets_select" on public.budgets for select
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));
create policy "budgets_write_admin" on public.budgets for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

create policy "kpis_select" on public.kpis for select
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));
create policy "kpis_write_admin" on public.kpis for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

create policy "risks_select" on public.risks for select
  using (
    public.is_studio_admin()
    or venture_id in (select public.member_venture_ids())
    or venture_id is null
  );
create policy "risks_write_admin" on public.risks for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());

-- profiles: everyone can read their own row; admins can read all.
-- No self-service update policy yet (avoids letting a user grant themselves
-- is_studio_admin) — profile edits are a later piece with proper column guards.
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_studio_admin());

-- venture_members: users see their own memberships; admins see/manage all.
create policy "venture_members_select" on public.venture_members for select
  using (user_id = auth.uid() or public.is_studio_admin());
create policy "venture_members_write_admin" on public.venture_members for all
  using (public.is_studio_admin()) with check (public.is_studio_admin());
