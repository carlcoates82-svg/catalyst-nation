-- Paperclip: the AI agent workforce layer, alongside Catalyst OS's record.
-- Agents/goals/tasks/activity_log are venture-scoped exactly like the
-- existing domain tables (denormalized venture_id on every table, even
-- tasks/activity_log which reach it via goal/agent, so RLS stays a simple
-- direct check rather than a join).
--
-- Unlike the Protocol phase budgets (0001), agent budgets are not an
-- admin-only financial control — a Founder CEO runs their own venture's
-- agents day to day, so venture members get full read/write here, same as
-- kpis/validation/risks (0002).

create table if not exists public.agents (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  name text not null,
  role text,
  system_prompt text not null,
  budget_allocated numeric not null default 0,
  budget_spent numeric not null default 0,
  currency text not null default 'EUR',
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);
create index if not exists agents_venture_id_idx on public.agents(venture_id);

create table if not exists public.goals (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'done', 'abandoned')),
  created_at timestamptz not null default now()
);
create index if not exists goals_venture_id_idx on public.goals(venture_id);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  goal_id bigint not null references public.goals(id) on delete cascade,
  agent_id bigint not null references public.agents(id) on delete cascade,
  title text not null,
  instructions text not null,
  status text not null default 'todo' check (status in ('todo', 'running', 'done', 'failed')),
  result text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_venture_id_idx on public.tasks(venture_id);
create index if not exists tasks_goal_id_idx on public.tasks(goal_id);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  venture_id bigint not null references public.ventures(id) on delete cascade,
  agent_id bigint not null references public.agents(id) on delete cascade,
  task_id bigint references public.tasks(id) on delete cascade,
  event_type text not null check (event_type in ('task_completed', 'task_failed')),
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_venture_id_idx on public.activity_log(venture_id);

alter table public.agents enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

create policy "agents_all_member" on public.agents for all
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()))
  with check (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));

create policy "goals_all_member" on public.goals for all
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()))
  with check (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));

create policy "tasks_all_member" on public.tasks for all
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()))
  with check (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));

create policy "activity_log_all_member" on public.activity_log for all
  using (public.is_studio_admin() or venture_id in (select public.member_venture_ids()))
  with check (public.is_studio_admin() or venture_id in (select public.member_venture_ids()));
