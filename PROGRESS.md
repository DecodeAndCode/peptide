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
- [ ] Step 10: Dashboard overview
- [ ] Step 11: Reports (in-app + PDF + email)
- [ ] Step 12: Content generator
- [ ] Step 13: Influencer matching
- [ ] Step 14: Settings page
- [ ] Step 15: Security hardening

## Deviations from prompt
- Pricing card copy aligned to Section 11 (source of truth) rather
  than supgo.html — confirmed correct
- Perplexity citation URLs are stored in a new `prompts.citation_urls`
  column via a follow-up migration so they remain queryable separately
  from raw response text

## Known issues / TODOs
- Supabase CLI not yet configured — migrations applied manually for now

## Next session starting point
Step 10 — Dashboard overview