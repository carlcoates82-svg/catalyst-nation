-- Demo data for Catalyst Nation. Run after 0001_init.sql in the Supabase SQL
-- editor. Safe to re-run (guarded by a name check).

insert into public.ventures (name, sector, thesis, buyer, founder_ceo, stage, status)
select 'Compliance Copilot', 'RegTech', 'AI compliance officer for mid-market regulated firms', 'Compliance Officer', 'Jane Doe', 'Pilot', 'active'
where not exists (select 1 from public.ventures where name = 'Compliance Copilot');

-- Budgets, KPI and a risk against that seeded venture.
with v as (select id from public.ventures where name = 'Compliance Copilot')
insert into public.budgets (venture_id, phase, allocated, spent, currency)
select v.id, 'mvp', 40000, 22000, 'EUR' from v
where not exists (
  select 1 from public.budgets b join v on b.venture_id = v.id where b.phase = 'mvp'
);

with v as (select id from public.ventures where name = 'Compliance Copilot')
insert into public.kpis (venture_id, as_of, arr, customers, pipeline, note)
select v.id, current_date, 36000, 3, 90000, 'Seed data' from v
where not exists (select 1 from public.kpis k join v on k.venture_id = v.id);

with v as (select id from public.ventures where name = 'Compliance Copilot')
insert into public.risks (venture_id, description, severity, likelihood, status)
select v.id, 'Regulatory API access still pending approval', 'medium', 'medium', 'open' from v
where not exists (select 1 from public.risks r join v on r.venture_id = v.id);

with v as (select id from public.ventures where name = 'Compliance Copilot')
insert into public.gates (venture_id, stage, decision, rationale)
select v.id, 'Build', 'proceed', 'MVP demoed to 3 design partners, all confirmed pilot intent' from v
where not exists (select 1 from public.gates g join v on g.venture_id = v.id);
