alter table public.influencer_matches
add column if not exists source_urls text[] not null default '{}',
add column if not exists fit_score integer,
add column if not exists verification_status text,
add column if not exists verification_confidence integer;

update public.influencer_matches
set
  source_urls = coalesce(source_urls, '{}'),
  fit_score = coalesce(fit_score, 5),
  verification_status = coalesce(verification_status, 'low_confidence'),
  verification_confidence = coalesce(verification_confidence, 0)
where
  fit_score is null
  or verification_status is null
  or verification_confidence is null;

alter table public.influencer_matches
alter column fit_score set default 5,
alter column verification_status set default 'low_confidence',
alter column verification_confidence set default 0;

alter table public.influencer_matches
drop constraint if exists influencer_matches_fit_score_check;

alter table public.influencer_matches
add constraint influencer_matches_fit_score_check
check (fit_score is null or (fit_score >= 1 and fit_score <= 10));

alter table public.influencer_matches
drop constraint if exists influencer_matches_verification_status_check;

alter table public.influencer_matches
add constraint influencer_matches_verification_status_check
check (
  verification_status is null or verification_status in ('grounded', 'low_confidence')
);

alter table public.influencer_matches
drop constraint if exists influencer_matches_verification_confidence_check;

alter table public.influencer_matches
add constraint influencer_matches_verification_confidence_check
check (
  verification_confidence is null or (verification_confidence >= 0 and verification_confidence <= 100)
);
