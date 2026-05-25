# SuppGo — Influencer discovery handoff

> **Purpose:** Onboard a new chat on **creator matching** (Perplexity → validation → GPT → DB). For full product backlog, see [`HANDOFF_SUPPGO.md`](./HANDOFF_SUPPGO.md).

---

## When you open a new chat, do this

1. **Open the `peptide` repo** in Cursor (workspace root).
2. **Attach or @-mention** this file: `HANDOFF_INFLUENCERS.md` (and optionally `HANDOFF_SUPPGO.md` for broader roadmap).
3. **Paste a kickoff** like:

   ```
   Read HANDOFF_INFLUENCERS.md. I want to work on: [e.g. brand archetypes in discovery queries /
   stricter scoring / SocialFetch verify defaults / UI hints].
   ```

4. Ask the model to **grep/read** the key paths below before refactoring.

---

## Product behavior (current)

- **Default:** **Perplexity** web-grounded discovery → **strict validation** → **GPT** scores + writes outreach copy → save **up to 3** matches per cycle (`MAX_INFLUENCER_MATCHES_SAVED_PER_CYCLE`).
- **Legacy path:** `SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY=true` uses **OpenAI + SocialFetch** discovery (`socialfetch-discovery.ts`).
- **Optional hard verification:** `SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH=true` + `SOCIALFETCH_API_KEY` re-checks each Perplexity-approved candidate via SocialFetch (drops missing/under-floor profiles; **uses credits**).

---

## Validation rules (Perplexity candidates)

Implemented in `lib/influencers/matcher.ts` → `validateDiscoveryCandidate`:

1. **Profile URL evidence:** At least one URL among `source_url` and Perplexity `citationUrls` must parse (via `extractHandleFromProfileUrl` / `getMatchingProfileUrls`) as the **same handle** on the declared platform. **No** synthetic “canonical URL only” fallback (that previously allowed hallucinated handles).
2. **Follower floor:** `follower_estimate` must parse (`parseFollowerEstimate`) to **≥ `MIN_INFLUENCER_FOLLOWERS` (3000)**. Parsing tolerates `+`, the word “followers”, `k`/`M`, etc.
3. **Confidence** reflects `source_url` match, citation match, topics — scores are no longer uniformly inflated for junk rows.

If **raw Perplexity rows exist** but **zero** pass validation, `discoverInfluencersWithProviders` returns a **`discoveryHint`** explaining URL + follower requirements (and optional SocialFetch verify).

---

## Environment variables

| Variable | Role |
|----------|------|
| `PERPLEXITY_API_KEY` | **Required** for default influencer discovery. |
| `SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY` | `true` → legacy SocialFetch **discovery** (not default). |
| `SUPPGO_INFLUENCER_USE_PERPLEXITY` | Legacy inverse: `"false"` can still steer toward SocialFetch discovery (see `shouldUsePerplexityForInfluencerDiscovery` in `lib/supabase/env.ts`). |
| `SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH` | `true` + `SOCIALFETCH_API_KEY` → post-Perplexity **profile verification** (optional; credits). |
| `SOCIALFETCH_API_KEY` | Legacy discovery and/or verification. |
| `SUPPGO_INFLUENCER_USE_STATIC_HANDLE_POOL` | Curated JSON pool (SocialFetch **discovery** path). |
| `SUPPGO_INFLUENCER_SF_MAX_LOOKUPS` / `SUPPGO_INFLUENCER_SF_STOP_AFTER_VERIFIED` | Legacy discovery caps. |

**Helpers:** `isPerplexityConfigured()`, `getInfluencerDiscoveryBackend()`, `shouldVerifyPerplexityCandidatesWithSocialFetch()` in `lib/supabase/env.ts`.

**Sample:** `.env.local.example` (influencer section).

---

## Key files

| Area | Path |
|------|------|
| Orchestration, validation, save, GPT scoring | `lib/influencers/matcher.ts` |
| Perplexity queries + Zod schema + JSON parse | `lib/influencers/providers/perplexity.ts` |
| Perplexity HTTP | `lib/llm/perplexity.ts` (`queryPerplexity(prompt, { maxTokens })`) |
| Legacy discovery | `lib/influencers/providers/socialfetch-discovery.ts` |
| Profile lookup | `lib/influencers/providers/socialfetch-client.ts` |
| Refresh API | `app/api/influencers/match/route.ts` (`discoveryBackend` in JSON) |
| UI | `app/(dashboard)/influencers/page.tsx`, `components/dashboard/RefreshInfluencerMatchesButton.tsx` |
| Types | `lib/influencers/providers/types.ts` |

---

## Logging (debug)

- **`[perplexity]`** — missing key, HTTP errors.
- **`[influencer-discovery]`** — JSON parse/schema mismatch, query failures.
- **`[influencer-matcher]`** — stages: `discovered`, `empty_result`, `perplexity_hits_all_filtered`, `perplexity_unconfigured`, `saved`, etc.
- **`[socialfetch]`** — verification / legacy API issues.

---

## Known pitfalls (already resolved in thread)

- **`PERPLEXITY_API_KEY` unset or commented** → 0 candidates; logs show missing env. **Restart** `npm run dev` after fixing `.env.local`.
- **Over-relaxed validation** (inferred profile URL + unknown followers) → fake/unrelated accounts; **tightened** as above.
- **Strict rules** → fewer matches until the model returns **canonical profile URLs** + **parseable counts**; optional SocialFetch verify improves fidelity at cost.

---

## Product direction (next / not fully built)

- **Brand + consumer “archetypes”** (e.g. hybrid strength + running vs generic bodybuilding) to **narrow** `buildDiscoveryQueries` and the **GPT scoring rubric** beyond `INDUSTRY_NICHE_GUIDANCE` in `matcher.ts` / `perplexity.ts`.
- Likely needs **structured brand fields** (primary archetypes, anti-patterns) + alignment with **main cycle prompts** for consistent positioning.

---

## Sanity check after code changes

```bash
npx tsc --noEmit
```

---

## API note

`POST /api/influencers/match` returns `matches.discoveryBackend` (`"perplexity"` | `"socialfetch"`), not legacy `providerMode`.
