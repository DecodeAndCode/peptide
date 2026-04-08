alter table public.brands
add column if not exists brand_aliases text[] not null default '{}';
