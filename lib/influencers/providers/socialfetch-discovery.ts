import "server-only";
import { z } from "zod";
import {
  getInfluencerDiscoveryMaxSocialFetchLookups,
  getInfluencerDiscoveryStopAfterVerified,
  isSocialFetchConfigured,
} from "@/lib/supabase/env";
import { queryOpenAi } from "@/lib/llm/openai";
import type { DiscoveryCandidate, InfluencerProviderContext } from "./types";
import type { InfluencerPlatform } from "@/types";
import { buildDiscoveryQueries, influencerDiscoveryHitsSchema } from "./perplexity";
import {
  fetchSocialFetchProfileResult,
  type SocialFetchProfileSnapshot,
} from "./socialfetch-client";
import { resolveStaticBrandHandleSuggestions } from "./static-handle-pool";

const MAX_GPT_JSON_ROWS_PER_PROMPT = 6;

interface SuggestionRow {
  platform: InfluencerPlatform;
  handle: string;
  topics: string[];
}

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function parseDiscoveryJson<T>(value: string, schema: z.ZodSchema<T>): T | null {
  try {
    const parsed = JSON.parse(stripMarkdownCodeFence(value));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function normalizeHandle(value: string) {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function tokenizeBio(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 4),
    ),
  ).slice(0, 4);
}

function snapshotToCandidate(
  platform: InfluencerPlatform,
  suggestedTopics: string[],
  profile: SocialFetchProfileSnapshot,
  minFollowerCount: number,
): DiscoveryCandidate | null {
  const followers = profile.followerCount ?? 0;
  if (followers < minFollowerCount) {
    return null;
  }

  const socialUrl =
    platform === "instagram"
      ? `https://www.instagram.com/${profile.handle}`
      : `https://www.tiktok.com/@${profile.handle}`;

  const topicSignals = tokenizeBio(profile.bio);
  const topics = Array.from(new Set([...suggestedTopics, ...topicSignals])).slice(0, 5);

  let verificationConfidence = 62;
  if (profile.followerCount !== null) {
    verificationConfidence = Math.min(100, verificationConfidence + 10);
  }
  if (profile.verified) {
    verificationConfidence = Math.min(100, verificationConfidence + 8);
  }
  if (followers >= minFollowerCount) {
    verificationConfidence = Math.min(100, verificationConfidence + 5);
  }

  return {
    handle: profile.handle.replace(/^@+/, "").trim().toLowerCase(),
    platform,
    followerEstimate: followers.toLocaleString("en-US"),
    postCountEstimate: "",
    lastActive: "",
    engagementSignals: profile.verified ? "verified account" : "",
    evidenceQuotes: [],
    externalCitations: [],
    topics,
    sourceUrls: [socialUrl],
    verificationConfidence,
    verificationStatus: verificationConfidence >= 70 ? "grounded" : "low_confidence",
  };
}

function isQuotaSpendOrThrottleStatus(status: number | undefined) {
  return status === 402 || status === 403 || status === 429;
}

async function verifySuggestedProfilesSequential(
  suggestions: SuggestionRow[],
  context: InfluencerProviderContext,
  budgets: {
    maxLookups: number;
    stopAfterVerified: number;
    /** Stop after verifying this many rows even if unsuccessful (spread cost across GPT batches). */
    maxRowsPerBatch?: number;
  },
): Promise<{
  candidates: DiscoveryCandidate[];
  lookupsUsed: number;
  rowsAttempted: number;
  sawAuthError: boolean;
  sawQuotaOrThrottle: boolean;
}> {
  const out: DiscoveryCandidate[] = [];
  let lookupsUsed = 0;
  let rowsAttempted = 0;
  let sawAuthError = false;
  let sawQuotaOrThrottle = false;

  const capRows = budgets.maxRowsPerBatch ?? suggestions.length;

  for (const s of suggestions) {
    if (rowsAttempted >= capRows) {
      break;
    }
    if (out.length >= budgets.stopAfterVerified) {
      break;
    }
    if (lookupsUsed >= budgets.maxLookups) {
      break;
    }
    if (!s.handle) {
      continue;
    }

    rowsAttempted += 1;
    lookupsUsed += 1;

    const result = await fetchSocialFetchProfileResult(s.platform, s.handle);
    if (!result.ok) {
      if (result.reason === "http_error") {
        if (result.httpStatus === 401) {
          sawAuthError = true;
        } else if (isQuotaSpendOrThrottleStatus(result.httpStatus)) {
          sawQuotaOrThrottle = true;
        }
      }
      continue;
    }

    const candidate = snapshotToCandidate(s.platform, s.topics, result.snapshot, context.minFollowerCount);
    if (candidate) {
      out.push(candidate);
    }
  }

  return { candidates: out, lookupsUsed, rowsAttempted, sawAuthError, sawQuotaOrThrottle };
}

function dedupeSuggestionRows(rows: SuggestionRow[]): SuggestionRow[] {
  const map = new Map<string, SuggestionRow>();
  for (const row of rows) {
    const key = `${row.platform}:${row.handle}`;
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

/**
 * Verifies curated handles only (no OpenAI calls at refresh). Edit
 * lib/influencers/data/static-influencer-handles.json to grow coverage.
 */
export async function discoverWithStaticPoolAndSocialFetch(context: InfluencerProviderContext): Promise<{
  candidates: DiscoveryCandidate[];
  hint?: string;
}> {
  if (!isSocialFetchConfigured()) {
    return { candidates: [] };
  }

  const suggestions = dedupeSuggestionRows(resolveStaticBrandHandleSuggestions(context));
  const maxLookups = getInfluencerDiscoveryMaxSocialFetchLookups();
  const stopAfterVerified = getInfluencerDiscoveryStopAfterVerified();

  if (suggestions.length === 0) {
    return {
      candidates: [],
      hint: "Static influencer pool returned no handles. Populate lib/influencers/data/static-influencer-handles.json for each industry tag.",
    };
  }

  const rowCap = Math.min(suggestions.length, maxLookups);
  const { candidates, lookupsUsed, sawAuthError, sawQuotaOrThrottle } = await verifySuggestedProfilesSequential(
    suggestions,
    context,
    { maxLookups, stopAfterVerified, maxRowsPerBatch: rowCap },
  );

  console.info("[influencer-discovery]", {
    stage: "static_pool",
    poolSize: suggestions.length,
    verifiedCount: candidates.length,
    lookupsUsed,
    cap: maxLookups,
    stopAfter: stopAfterVerified,
  });

  if (candidates.length > 0) {
    return { candidates };
  }

  const triedAnyLookup = lookupsUsed > 0;

  if (sawAuthError) {
    return {
      candidates: [],
      hint: "SocialFetch rejected the API key (HTTP 401). Check SOCIALFETCH_API_KEY in .env.local or rotate the key.",
    };
  }

  if (sawQuotaOrThrottle) {
    return {
      candidates: [],
      hint: "SocialFetch returned quota/rate-limit or billing-related errors (e.g. HTTP 402/403/429). Top up at socialfetch.dev or raise SUPPGO_INFLUENCER_SF_MAX_LOOKUPS sparingly.",
    };
  }

  if (!triedAnyLookup) {
    return {
      candidates: [],
      hint: "No SocialFetch lookups were attempted (budget was zero or handles were skipped). Check SUPPGO_INFLUENCER_SF_MAX_LOOKUPS.",
    };
  }

  return {
    candidates: [],
    hint: "Static handles did not yield enough verified creators (wrong handles vs platform or below follower floor). Expand the JSON pool or lower minimum followers in matcher only if intentional.",
  };
}

/**
 * Discover influencers without Perplexity: GPT suggests a small candidate set per query; SocialFetch
 * verifies sequentially with hard lookup and success caps.
 */
export async function discoverWithOpenAiAndSocialFetch(context: InfluencerProviderContext): Promise<{
  candidates: DiscoveryCandidate[];
  hint?: string;
}> {
  if (!isSocialFetchConfigured()) {
    return { candidates: [] };
  }

  const maxLookups = getInfluencerDiscoveryMaxSocialFetchLookups();
  const stopAfterVerified = getInfluencerDiscoveryStopAfterVerified();

  const discoveryQueries = buildDiscoveryQueries(context);
  const collected: DiscoveryCandidate[] = [];
  let lookupsSoFar = 0;
  let openAiRowsParsed = 0;
  let sawAuthError = false;
  let sawQuotaOrThrottle = false;

  for (const query of discoveryQueries) {
    if (collected.length >= stopAfterVerified) {
      break;
    }
    if (lookupsSoFar >= maxLookups) {
      break;
    }

    try {
      const prompt = [
        query,
        "Suggest real creators with public profiles on the platform indicated in the search context.",
        "Prefer widely-known handles so API verification succeeds.",
        `Return 3–6 creators only. Each should have roughly ${context.minFollowerCount.toLocaleString()}+ public followers.`,
        `Return JSON array only: [{"handle":"","platform":"instagram|tiktok","follower_estimate":"","topics":[""]}].`,
        "Use exact \"instagram\" or \"tiktok\" only. No markdown fences. No commentary.",
      ].join("\n");

      const response = await queryOpenAi(prompt, { maxOutputTokens: 2_048 });
      const parsed = parseDiscoveryJson(response.text, influencerDiscoveryHitsSchema);
      if (!parsed || parsed.length === 0) {
        console.info("[influencer-discovery]", {
          stage: "openai_parse_empty",
          modelResponseEmpty: response.text.trim().length === 0,
          responsePreview: response.text.trim().slice(0, 200),
        });
        continue;
      }

      openAiRowsParsed += parsed.length;

      const batchRows: SuggestionRow[] = [];
      for (const item of parsed.slice(0, MAX_GPT_JSON_ROWS_PER_PROMPT)) {
        const platform = item.platform as InfluencerPlatform;
        const handle = normalizeHandle(item.handle);
        if (!handle) {
          continue;
        }
        batchRows.push({
          platform,
          handle,
          topics: Array.isArray(item.topics) ? item.topics : [],
        });
      }

      const uniqueBatch = dedupeSuggestionRows(batchRows);
      const rowsBudget = Math.max(0, maxLookups - lookupsSoFar);

      const { candidates, lookupsUsed, sawAuthError: auth, sawQuotaOrThrottle: quota } =
        await verifySuggestedProfilesSequential(uniqueBatch, context, {
          maxLookups: rowsBudget,
          stopAfterVerified: stopAfterVerified - collected.length,
          maxRowsPerBatch: uniqueBatch.length,
        });

      lookupsSoFar += lookupsUsed;
      collected.push(...candidates);
      sawAuthError ||= auth;
      sawQuotaOrThrottle ||= quota;
    } catch (error) {
      console.warn("[influencer-discovery]", {
        stage: "openai_socialfetch_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.info("[influencer-discovery]", {
    stage: "openai_socialfetch",
    verifiedCount: collected.length,
    lookupsSoFar,
    cap: maxLookups,
    stopAfter: stopAfterVerified,
  });

  const deduped = dedupeCandidatesByHandle(collected);

  if (deduped.length > 0) {
    return { candidates: deduped };
  }

  if (openAiRowsParsed === 0) {
    return { candidates: [] };
  }

  if (sawAuthError) {
    return {
      candidates: [],
      hint: "SocialFetch rejected the API key (HTTP 401). Check SOCIALFETCH_API_KEY in .env.local or rotate the key.",
    };
  }

  if (sawQuotaOrThrottle) {
    return {
      candidates: [],
      hint: "SocialFetch returned quota/rate-limit or billing-related errors (e.g. HTTP 402/403/429)—free credits may be exhausted. Top up at socialfetch.dev, pause refreshes, or remove SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY to use the default Perplexity discovery path.",
    };
  }

  return {
    candidates: [],
    hint: "GPT suggested creators but SocialFetch could not verify them against the follower floor or profiles were missing. Check server logs for [socialfetch].",
  };
}

function dedupeCandidatesByHandle(items: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const map = new Map<string, DiscoveryCandidate>();
  for (const item of items) {
    const key = `${item.platform}:${item.handle}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}
