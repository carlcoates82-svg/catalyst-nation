-- Lets venture members (CEOs) report data on their own venture — KPIs,
-- spend, validation evidence, risks — without needing studio-admin rights.
-- Gate decisions (advance/kill/hold) remain admin-only; those aren't granted
-- here on purpose (the Catalyst Protocol's discipline is a studio call).

create policy "kpis_insert_member" on public.kpis for insert
  with check (venture_id in (select public.member_venture_ids()));

create policy "validation_insert_member" on public.validation for insert
  with check (venture_id in (select public.member_venture_ids()));

create policy "risks_insert_member" on public.risks for insert
  with check (venture_id in (select public.member_venture_ids()));

-- Budgets: members can create the phase row (recordSpend auto-creates a
-- zero-allocation row if missing) and update spent/currency on their own
-- venture's rows, but not change the allocated cap — that stays an admin
-- decision via the existing budgets_write_admin policy.
create policy "budgets_insert_member" on public.budgets for insert
  with check (venture_id in (select public.member_venture_ids()));

create policy "budgets_update_spend_member" on public.budgets for update
  using (venture_id in (select public.member_venture_ids()))
  with check (venture_id in (select public.member_venture_ids()));

-- RLS alone can't restrict which columns a policy-permitted UPDATE touches,
-- so enforce the "allocated is admin-only" rule with a trigger instead.
create or replace function public.enforce_budget_allocated_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_studio_admin() and new.allocated is distinct from old.allocated then
    raise exception 'Only studio admins can change the allocated budget';
  end if;
  return new;
end;
$$;

drop trigger if exists budgets_allocated_admin_only on public.budgets;
create trigger budgets_allocated_admin_only
  before update on public.budgets
  for each row execute function public.enforce_budget_allocated_admin_only();
