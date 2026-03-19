# SuppGo Build Progress

## Completed
- [x] Step 1: Scaffolding
- [x] Step 2: Marketing page
- [x] Step 3: Supabase schema + RLS
- [x] Step 4: Auth flows
- [x] Step 5: Onboarding wizard
- [x] Step 6: Dashboard shell
- [x] Step 7: LLM query engine
- [x] Step 8: Prompt engine + brand scorer
- [x] Step 9: Cycle runner
- [x] Step 10: Dashboard overview
- [x] Step 11: Reports (in-app + PDF + email)
- [x] Step 12: Content generator
- [x] Step 13: Influencer matching
- [x] Step 14: Settings page
- [x] Step 15: Security hardening

## Deviations from prompt
- Pricing card copy aligned to Section 11 (source of truth) rather
  than supgo.html — confirmed correct
- Perplexity citation URLs are stored in a new `prompts.citation_urls`
  column via a follow-up migration so they remain queryable separately
  from raw response text
- brand_aliases column added to brands table for 
  multi-name brand matching
- Curated competitor catalog expanded to 150+ brands
- Claude Haiku secondary extraction pass added to 
  brand-scorer.ts for complete competitor capture
- Haiku model string updated to claude-haiku-4-5-20251001
- Prompt engine: 20% hero injection, crawler-signal 
  weighting, tier-based category depth all implemented
- model_refused added as valid sentiment classification
- Dashboard and report competitor benchmarking are hidden on Starter
  to match Section 11 tier gating
- Product interaction drafts generate only for Growth and Pro;
  Starter still receives FAQ snippet and llms.txt output
- Pro content generation uses Perplexity-backed research and
  filtered authority citations; Growth falls back to non-Perplexity
  draft generation to respect tier model gating
- Resend delivery currently uses the Resend test sender
  (`onboarding@resend.dev`) until a verified SuppGo sender domain exists
- App Router route groups mean authenticated pages resolve at `/reports`,
  `/influencers`, and `/settings` rather than `/dashboard/*` child paths
- Rate limiting was applied to the repo's current LLM-backed and report
  endpoints (`/api/cycles/trigger`, `/api/influencers/match`, and report
  routes) because dedicated `/api/llm/*` endpoints are not present here
- Added a dev-only verification route and script so TEST_MODE cycles can be
  run against live Supabase data without relying on browser automation

## Known issues / TODOs
- Supabase CLI not yet configured — migrations applied manually for now
- Report delivery requires `RESEND_API_KEY`; production email sending
  should be switched to a verified SuppGo domain before launch

## Pre-launch TODOs
- [ ] Replace the temporary Resend sender (`onboarding@resend.dev`)
  with a verified SuppGo production domain before launch
- [ ] Stripe billing integration
- [ ] Modash API swap for influencer matching
- [ ] Supabase CLI configuration
- [ ] OpenAI + Anthropic org account conversion (for DPAs)
- [ ] Anthropic Tier 2 upgrade ($40 cumulative spend)
- [ ] Remove or formalize dev-only verification route

## Session 5 fixes shipped
- Reports navigation now routes to `/reports`, and in-app report links now
  point to `/reports/[cycleId]`
- Generated content persistence is fixed with safe post-cycle error logging
  and fallback draft generation so Starter cycles still store FAQ + llms.txt
- Dashboard and report numeric displays now render as rounded integers
- YTD graph now shows a 3-cycle empty state, adds time granularity for
  duplicate calendar dates, and hides inactive model legend entries
- Content opportunity copy now wraps embedded prompt text in quotation marks
- Influencer matching, settings, rate limiting, CSP headers, and same-origin
  request enforcement are now live

## Session 4 decisions
- Keep the temporary Resend sender as `onboarding@resend.dev` for now;
  verified production sender setup is a pre-launch task
- Growth-tier fallback content generation is confirmed correct:
  Growth receives generated content without Perplexity citation sourcing,
  while Pro retains Perplexity-backed citation research as a differentiator

## Verification
- Dev verification route confirmed a TEST_MODE Starter cycle completed with
  10 prompt executions and wrote 4 `generated_content` rows
- Verified stored content types included `llms_txt` and `faq_snippet`

## Next session starting point
Post-MVP polish, launch prep, and production integrations