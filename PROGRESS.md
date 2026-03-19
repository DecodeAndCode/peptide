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
- [ ] Step 13: Influencer matching
- [ ] Step 14: Settings page
- [ ] Step 15: Security hardening

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

## Known issues / TODOs
- Supabase CLI not yet configured — migrations applied manually for now
- Report delivery requires `RESEND_API_KEY`; production email sending
  should be switched to a verified SuppGo domain before launch

## Pre-launch TODOs
- Replace the temporary Resend sender (`onboarding@resend.dev`)
  with a verified SuppGo production domain before launch

## Session 5 starting issues
- Reports sidebar link points to `/dashboard/reports` (404) while the
  currently working route resolves at `/reports`
- "View report" button is generating an href with an undefined `cycleId`
- `generated_content` still has 0 rows after completed cycles, so
  post-cycle content generation is failing silently
- Dashboard metric cards show unnecessary decimals such as `40.0`,
  `100.0%`, and `0.0%`
- YTD graph shows duplicate `Mar 18` x-axis labels and displays
  inactive model legend entries
- Content opportunity card copy should wrap embedded prompt text in
  quotation marks to avoid run-on phrasing

## Session 4 decisions
- Keep the temporary Resend sender as `onboarding@resend.dev` for now;
  verified production sender setup is a pre-launch task
- Growth-tier fallback content generation is confirmed correct:
  Growth receives generated content without Perplexity citation sourcing,
  while Pro retains Perplexity-backed citation research as a differentiator

## Next session starting point
Session 5 — resolve documented dashboard/report/content issues before
proceeding to Step 13