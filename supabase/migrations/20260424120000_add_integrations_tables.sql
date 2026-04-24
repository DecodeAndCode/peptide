-- v1.2: Direct Content Implementation
-- Add integration storage and content deployment tracking

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade not null,
  integration_type text not null,
  credentials jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, integration_type)
);

create table if not exists public.content_deployments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.generated_content(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete cascade not null,
  integration_type text not null,
  external_url text,
  status text not null default 'pending' check (status in ('pending', 'deployed', 'failed')),
  deployed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists integrations_brand_id_idx on public.integrations (brand_id);
create index if not exists content_deployments_content_id_idx on public.content_deployments (content_id);
create index if not exists content_deployments_brand_id_idx on public.content_deployments (brand_id);

-- RLS: each row is only accessible to the owning brand's user
alter table public.integrations enable row level security;

create policy "Users manage own integrations"
  on public.integrations
  for all
  using (
    brand_id in (
      select id from public.brands where user_id = auth.uid()
    )
  );

alter table public.content_deployments enable row level security;

create policy "Users manage own content deployments"
  on public.content_deployments
  for all
  using (
    brand_id in (
      select id from public.brands where user_id = auth.uid()
    )
  );
