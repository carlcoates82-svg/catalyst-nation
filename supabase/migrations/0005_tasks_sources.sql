-- Stores structured web-search sources (title/url) separately from a
-- task's free-text result, so the UI can render a clean "Sources" list
-- rather than parsing them out of prose.
alter table public.tasks add column if not exists sources jsonb;
