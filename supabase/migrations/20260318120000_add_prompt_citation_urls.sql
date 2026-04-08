alter table public.prompts
add column if not exists citation_urls text[] not null default '{}';
