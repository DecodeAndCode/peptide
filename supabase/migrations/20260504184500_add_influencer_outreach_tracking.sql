alter table public.influencer_matches
add column if not exists outreach_status text default 'not_contacted',
add column if not exists outreach_notes text,
add column if not exists last_outreach_at timestamptz;

update public.influencer_matches
set outreach_status = coalesce(outreach_status, 'not_contacted')
where outreach_status is null;

alter table public.influencer_matches
alter column outreach_status set default 'not_contacted';

alter table public.influencer_matches
drop constraint if exists influencer_matches_outreach_status_check;

alter table public.influencer_matches
add constraint influencer_matches_outreach_status_check
check (
  outreach_status is null or outreach_status in ('not_contacted', 'contacted', 'responded', 'partnered', 'archived')
);
