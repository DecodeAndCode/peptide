create table if not exists public.partner_matches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  cycle_id uuid references public.cycles(id) on delete cascade,
  partner_type text not null check (partner_type in ('gym', 'apparel', 'retailer', 'other')),
  name text not null,
  website_url text,
  region text,
  match_reason text,
  outreach_message text,
  source_urls text[] not null default '{}',
  fit_score integer,
  outreach_status text check (
    outreach_status is null or outreach_status in ('not_contacted', 'contacted', 'responded', 'partnered', 'archived')
  ),
  outreach_notes text,
  last_outreach_at timestamptz,
  shown_in_cycle integer[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.partner_matches
add constraint partner_matches_fit_score_check
check (fit_score is null or (fit_score >= 1 and fit_score <= 10));

create index if not exists partner_matches_brand_id_idx on public.partner_matches(brand_id);
create index if not exists partner_matches_cycle_id_idx on public.partner_matches(cycle_id);

alter table public.partner_matches enable row level security;

drop policy if exists "Partner matches are viewable by owner" on public.partner_matches;
create policy "Partner matches are viewable by owner"
on public.partner_matches
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Partner matches are insertable by owner" on public.partner_matches;
create policy "Partner matches are insertable by owner"
on public.partner_matches
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Partner matches are updatable by owner" on public.partner_matches;
create policy "Partner matches are updatable by owner"
on public.partner_matches
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Partner matches are deletable by owner" on public.partner_matches;
create policy "Partner matches are deletable by owner"
on public.partner_matches
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));
