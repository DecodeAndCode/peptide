-- v1.3: One-click Webflow CMS deployment

alter table public.content_deployments
  drop constraint if exists content_deployments_integration_type_check;

alter table public.content_deployments
  add column if not exists deployment_run_id uuid,
  add column if not exists external_id text,
  add column if not exists action_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists error_message text;

create table if not exists public.cms_deployment_runs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete cascade not null,
  integration_type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'partial_success', 'failed')),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  preview_links jsonb not null default '[]'::jsonb,
  warnings text[] not null default '{}',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_deployments_deployment_run_id_fkey'
  ) then
    alter table public.content_deployments
      add constraint content_deployments_deployment_run_id_fkey
      foreign key (deployment_run_id)
      references public.cms_deployment_runs(id)
      on delete set null;
  end if;
end $$;

create index if not exists cms_deployment_runs_brand_id_idx on public.cms_deployment_runs (brand_id);
create index if not exists cms_deployment_runs_cycle_id_idx on public.cms_deployment_runs (cycle_id);
create index if not exists content_deployments_run_id_idx on public.content_deployments (deployment_run_id);

alter table public.cms_deployment_runs enable row level security;

drop policy if exists "Users manage own CMS deployment runs" on public.cms_deployment_runs;
create policy "Users manage own CMS deployment runs"
  on public.cms_deployment_runs
  for all
  using (
    brand_id in (
      select id from public.brands where user_id = auth.uid()
    )
  );
