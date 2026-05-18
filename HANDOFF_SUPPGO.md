# SuppGo — Handoff: Current State & Backlog

> **Purpose:** Single doc for onboarding a new chat/session. Example kickoff:
> “Read `HANDOFF_SUPPGO.md`. Let’s start with **tier removal** and **Top Win / Top Miss uniqueness + definitions**.”

---

## How to continue in a new chat

1. **Open the peptide workspace** (this repo root).
2. **Paste something like:**
   ```
   Read HANDOFF_SUPPGO.md at the repo root. Prioritize §3 backlog in order unless I say otherwise. Start with P0 items.
   ```
3. **Or be specific:**
   ```
   HANDOFF_SUPPGO.md §6 Option A — implement tier removal and fix Top Win ≠ Top Miss.
   ```
4. **Influencer-only work:** use **`HANDOFF_INFLUENCERS.md`** (current Perplexity-default stack, validation, env vars).

The model should grep/read `lib/suppgo.ts`, cycle runner, influencer matcher, report/dashboard code paths referenced in §5–§6 before large refactors. For creator matching details, read **`HANDOFF_INFLUENCERS.md`**.

---

## 1. Product snapshot

**SuppGo** — AI visibility / prompt monitoring for wellness brands (`peptide` repo).

### What reliably works today (demo-safe narrative)

- **Page crawl → site analysis** (signals drive downstream behavior).
- **Multi-model cycles** (OpenAI / Anthropic; former “Pro” also used Perplexity).
- **Scoring**, **analytics / dashboard**.
- **Report generation** (in-app + PDF + email as implemented).
- **Automated content generation** (FAQ, llms.txt-style artifacts; historically tier-gated types).
- **Engineering:** dev/test env flags for cycles and influencer APIs (§5).

### What’s constrained / “stuck”

- **Influencer matching:** In-product flow is **Perplexity-default** for discovery (strict URL + follower validation) with optional **SocialFetch** verification; legacy **SocialFetch discovery** remains opt-in. Quality vs quota still depends on API behavior — see **`HANDOFF_INFLUENCERS.md`**.
- **CMS integration:** In progress; **Shopify-first** is the stated priority.

### Horizon / roadmap themes

- **Richer prompts** from researched **customer + industry archetypes** (deeper libraries than today’s templating).

---

## 2. Post–demo meeting themes

### Product / GTM

- **Influencer matching:** Pick a **primary vendor/strategy** and stick to it (economics + trust).
- **Remove tiering:** Ship **everything the old “Pro” tier offered** to everyone until there are customers—simplify demo, onboarding, support.

### UX / QoL

1. **“High leverage steps”** — add **expand / click-through** copy (what, why, where outputs land).
2. **First dashboard visit:** **Tutorial / spotlight** (blur backdrop, step through Visibility, mention rate, etc.).
3. **Post-push FAQ preview** — idea stage; can start generic + disclaimer before Shopify-perfect styling.
4. **Content ↔ score narrative** — users need an **honest, visible link** between published work and cycle deltas (§4).

### Bugs / clarity (demo: MyProtein)

- **Top Win and Top Miss must never reference the same prompt** — disjoint selection + **definitions in UI**.
- **“Product Interaction” vs “FAQ Snippet”** on similar drafts — align **routing rules** + **one-line rationale** on cards; reinforce in tutorial.

---

## 3. Backlog order (suggested)

| Priority | Track        | Summary |
|----------|--------------|---------|
| **P0**   | Platform     | **Tier removal** — single effective surface = former Pro (`getTierAnalysisConfig` / `subscription_tier` audits). |
| **P0**   | Reports      | **Top Win ≠ Top Miss** + definitions in UI (+ tutorial hooks). |
| **P1**   | Content UX   | Draft type **taxonomy + “why this type”** lines. |
| **P1**   | Onboarding   | First-run **dashboard walkthrough**. |
| **P1**   | Integrations | **Shopify** golden path ahead of generic CMS. |
| **P2**   | Influencer   | **Archetypes** in discovery/scoring (narrow creator-brand fit); tune prompts; optional SocialFetch verify economics. See `HANDOFF_INFLUENCERS.md`. |
| **P2**   | Proof        | MVP **publish window + themed prompt deltas** (correlation, not faux causality). |
| **P3**   | Polish       | High-leverage expansions; push-preview experiments. |

---

## 4. Content ↔ scores (recommended framing)

Do **not** claim strict causal proof. Prefer **explainable attribution:**

1. Map artifacts to prompt **themes**.
2. **Timeline:** “Marked live” / Shopify event before cycle *N*.
3. **Before/after** on comparable prompt slices: mentions, sentiment, competitors.
4. **Copy:** *correlated shifts after publish* — not “because FAQ #3, +12%.”

---

## 5. Recent technical context (LLM / influencer)

*Authoritative detail: **`HANDOFF_INFLUENCERS.md`**.*

- **`SUPPGO_CYCLE_SKIP_PERPLEXITY`** (non‑prod): omits Perplexity from cycle model list — see `lib/analysis/cycle-runner.ts`.
- **Influencer (default):** **Perplexity** discovery → strict validation (cited profile URL ↔ handle, follower floor) → **GPT** scoring → save up to 3/cycle. **`PERPLEXITY_API_KEY`** required.
- **Optional:** **`SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH=true`** + **`SOCIALFETCH_API_KEY`** — live profile check after Perplexity (credits).
- **Legacy discovery:** **`SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY=true`** — GPT/static pool + **SocialFetch** verification; caps via **`SUPPGO_INFLUENCER_SF_MAX_LOOKUPS`** / **`SUPPGO_INFLUENCER_SF_STOP_AFTER_VERIFIED`**; **`SUPPGO_INFLUENCER_USE_STATIC_HANDLE_POOL`** → `lib/influencers/data/static-influencer-handles.json`.
- Logs: **`[perplexity]`**, **`[influencer-discovery]`**, **`[influencer-matcher]`**, **`[socialfetch]`**.
- **`lib/suppgo.ts`** — analysis config, influencer flag, etc.
- **Influencer UI:** `app/(dashboard)/influencers/page.tsx`; API: `app/api/influencers/match/route.ts` (`discoveryBackend`).

Env samples: `.env.local.example`.

---

## 6. Copy-paste session starters

### Option A — first sprint (agreed baseline)

```
Read HANDOFF_SUPPGO.md at repo root.

1. Remove tier gating everywhere: effective product = former Pro (models, influencer matching, draft types, dashboard/report gates). Audit lib/suppgo.ts and all subscription_tier / getTierAnalysisConfig usages.

2. Reports/dashboard: Top Win and Top Miss must always be distinct prompts; add brief UI definitions.

Ship with tsc clean; note any migration/default tier assumptions for brands in Supabase.
```

### Option B — after P0

```
P0 done. Next: HANDOFF_SUPPGO.md §2 UX — first-visit spotlight tour + expandable high-leverage steps.
```

### Option C — integrations

```
Shopify-first CMS: one golden path, document limits; defer other CMS per HANDOFF_SUPPGO.md §3 P1.
```

### Option D — influencer discovery & archetypes

```
Read HANDOFF_INFLUENCERS.md. Next: brand/customer archetypes in buildDiscoveryQueries + scoring; keep strict validation and document env toggles.
```

---

## 7. Open planning questions

- Influencer stack: SocialFetch‑only verify vs hybrid vs dedicated DB vendor later.
- When to **re-introduce tiers** (usage vs feature).
- Signal for correlation MVP: **manual “marked live”** vs **Shopify webhook**.

---

## See also

- **`HANDOFF_INFLUENCERS.md`** — creator matching (Perplexity default, SocialFetch legacy/verify, files, env, logs).
- `PROGRESS.md` — shipped milestones / deviations log (update when you merge major backlog items).

