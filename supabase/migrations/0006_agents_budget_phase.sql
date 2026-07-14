-- Adds an 'agents' budget phase so Paperclip task costs can flow into the
-- venture's budget burn automatically (the Paperclip → Catalyst OS sync from
-- the brief), as their own named line rather than polluting 'other'.
--
-- The row is auto-created with allocated = 0 the first time an agent task
-- completes; admins can then set an allocation cap like any other phase.

alter table public.budgets drop constraint budgets_phase_check;
alter table public.budgets add constraint budgets_phase_check
  check (phase in ('validation','mvp','pilot','agents','other'));
