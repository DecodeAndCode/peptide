create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_name text not null,
  website_url text not null,
  industry_tags text[] not null default '{}',
  competitor_urls text[] not null default '{}',
  subscription_tier text not null default 'starter' check (subscription_tier in ('starter', 'growth', 'pro')),
  subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'cancelled')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  cycle_number integer not null check (cycle_number > 0),
  models_queried text[] not null,
  total_prompts integer,
  mention_count integer,
  visibility_score numeric(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, cycle_number),
  check (visibility_score is null or (visibility_score >= 0 and visibility_score <= 100))
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete cascade not null,
  prompt_text text not null,
  prompt_category text not null check (
    prompt_category in (
      'explicit_recommendation',
      'problem_solution',
      'ingredient_education',
      'product_interaction'
    )
  ),
  model text not null check (model in ('gpt-4o', 'claude-sonnet', 'perplexity-sonar-pro')),
  raw_response text not null,
  brand_mentioned boolean not null default false,
  mention_rank integer check (mention_rank is null or mention_rank > 0),
  mention_context text,
  competitors_mentioned text[] not null default '{}',
  sentiment text check (sentiment is null or sentiment in ('positive', 'neutral', 'negative', 'not_mentioned')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_analyses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  crawled_at timestamptz not null default now(),
  pages_analyzed integer,
  has_llms_txt boolean not null default false,
  llms_txt_content text,
  has_schema_markup boolean not null default false,
  javascript_rendering_issues text[] not null default '{}',
  content_signals jsonb,
  missing_content_gaps text[] not null default '{}',
  recommendations text[] not null default '{}'
);

create table if not exists public.influencer_matches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  cycle_id uuid references public.cycles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  handle text not null,
  display_name text,
  follower_range text check (
    follower_range is null or follower_range in ('micro_10k_50k', 'mid_50k_200k', 'macro_200k+')
  ),
  niche_tags text[] not null default '{}',
  match_reason text,
  outreach_message text,
  shown_in_cycle integer[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.generated_content (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  cycle_id uuid references public.cycles(id) on delete set null,
  content_type text not null check (
    content_type in ('faq_snippet', 'product_interaction', 'llms_txt', 'blog_outline')
  ),
  title text,
  body text not null,
  target_prompts text[] not null default '{}',
  medical_sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  storage_path text not null,
  is_ready boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brands_user_id_idx on public.brands(user_id);
create index if not exists cycles_brand_id_idx on public.cycles(brand_id);
create index if not exists prompts_brand_id_idx on public.prompts(brand_id);
create index if not exists prompts_cycle_id_idx on public.prompts(cycle_id);
create index if not exists site_analyses_brand_id_idx on public.site_analyses(brand_id);
create index if not exists influencer_matches_brand_id_idx on public.influencer_matches(brand_id);
create index if not exists influencer_matches_cycle_id_idx on public.influencer_matches(cycle_id);
create index if not exists generated_content_brand_id_idx on public.generated_content(brand_id);
create index if not exists generated_content_cycle_id_idx on public.generated_content(cycle_id);
create index if not exists reports_brand_id_idx on public.reports(brand_id);
create index if not exists reports_cycle_id_idx on public.reports(cycle_id);

drop trigger if exists set_brands_updated_at on public.brands;
create trigger set_brands_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.cycles enable row level security;
alter table public.prompts enable row level security;
alter table public.site_analyses enable row level security;
alter table public.influencer_matches enable row level security;
alter table public.generated_content enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Brands are viewable by owner" on public.brands;
create policy "Brands are viewable by owner"
on public.brands
for select
using (user_id = auth.uid());

drop policy if exists "Brands are insertable by owner" on public.brands;
create policy "Brands are insertable by owner"
on public.brands
for insert
with check (user_id = auth.uid());

drop policy if exists "Brands are updatable by owner" on public.brands;
create policy "Brands are updatable by owner"
on public.brands
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Brands are deletable by owner" on public.brands;
create policy "Brands are deletable by owner"
on public.brands
for delete
using (user_id = auth.uid());

drop policy if exists "Cycles are viewable by owner" on public.cycles;
create policy "Cycles are viewable by owner"
on public.cycles
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Cycles are insertable by owner" on public.cycles;
create policy "Cycles are insertable by owner"
on public.cycles
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Cycles are updatable by owner" on public.cycles;
create policy "Cycles are updatable by owner"
on public.cycles
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Cycles are deletable by owner" on public.cycles;
create policy "Cycles are deletable by owner"
on public.cycles
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Prompts are viewable by owner" on public.prompts;
create policy "Prompts are viewable by owner"
on public.prompts
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Prompts are insertable by owner" on public.prompts;
create policy "Prompts are insertable by owner"
on public.prompts
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Prompts are updatable by owner" on public.prompts;
create policy "Prompts are updatable by owner"
on public.prompts
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Prompts are deletable by owner" on public.prompts;
create policy "Prompts are deletable by owner"
on public.prompts
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Site analyses are viewable by owner" on public.site_analyses;
create policy "Site analyses are viewable by owner"
on public.site_analyses
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Site analyses are insertable by owner" on public.site_analyses;
create policy "Site analyses are insertable by owner"
on public.site_analyses
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Site analyses are updatable by owner" on public.site_analyses;
create policy "Site analyses are updatable by owner"
on public.site_analyses
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Site analyses are deletable by owner" on public.site_analyses;
create policy "Site analyses are deletable by owner"
on public.site_analyses
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Influencer matches are viewable by owner" on public.influencer_matches;
create policy "Influencer matches are viewable by owner"
on public.influencer_matches
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Influencer matches are insertable by owner" on public.influencer_matches;
create policy "Influencer matches are insertable by owner"
on public.influencer_matches
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Influencer matches are updatable by owner" on public.influencer_matches;
create policy "Influencer matches are updatable by owner"
on public.influencer_matches
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Influencer matches are deletable by owner" on public.influencer_matches;
create policy "Influencer matches are deletable by owner"
on public.influencer_matches
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Generated content is viewable by owner" on public.generated_content;
create policy "Generated content is viewable by owner"
on public.generated_content
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Generated content is insertable by owner" on public.generated_content;
create policy "Generated content is insertable by owner"
on public.generated_content
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Generated content is updatable by owner" on public.generated_content;
create policy "Generated content is updatable by owner"
on public.generated_content
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Generated content is deletable by owner" on public.generated_content;
create policy "Generated content is deletable by owner"
on public.generated_content
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Reports are viewable by owner" on public.reports;
create policy "Reports are viewable by owner"
on public.reports
for select
using (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Reports are insertable by owner" on public.reports;
create policy "Reports are insertable by owner"
on public.reports
for insert
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Reports are updatable by owner" on public.reports;
create policy "Reports are updatable by owner"
on public.reports
for update
using (brand_id in (select id from public.brands where user_id = auth.uid()))
with check (brand_id in (select id from public.brands where user_id = auth.uid()));

drop policy if exists "Reports are deletable by owner" on public.reports;
create policy "Reports are deletable by owner"
on public.reports
for delete
using (brand_id in (select id from public.brands where user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Report files are viewable by owner" on storage.objects;
create policy "Report files are viewable by owner"
on storage.objects
for select
using (
  bucket_id = 'reports'
  and split_part(name, '/', 1) in (
    select id::text from public.brands where user_id = auth.uid()
  )
);

drop policy if exists "Report files are insertable by owner" on storage.objects;
create policy "Report files are insertable by owner"
on storage.objects
for insert
with check (
  bucket_id = 'reports'
  and split_part(name, '/', 1) in (
    select id::text from public.brands where user_id = auth.uid()
  )
);

drop policy if exists "Report files are updatable by owner" on storage.objects;
create policy "Report files are updatable by owner"
on storage.objects
for update
using (
  bucket_id = 'reports'
  and split_part(name, '/', 1) in (
    select id::text from public.brands where user_id = auth.uid()
  )
)
with check (
  bucket_id = 'reports'
  and split_part(name, '/', 1) in (
    select id::text from public.brands where user_id = auth.uid()
  )
);

drop policy if exists "Report files are deletable by owner" on storage.objects;
create policy "Report files are deletable by owner"
on storage.objects
for delete
using (
  bucket_id = 'reports'
  and split_part(name, '/', 1) in (
    select id::text from public.brands where user_id = auth.uid()
  )
);
