import { PERPLEXITY_API_MODEL_DEFAULT } from "@/lib/llm/shared";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseUrl() {
  return getEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getSupabaseServiceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getOpenAiApiKey() {
  return getEnv("OPENAI_API_KEY");
}

export function getAnthropicApiKey() {
  return getEnv("ANTHROPIC_API_KEY");
}

export function getPerplexityApiKey() {
  return getEnv("PERPLEXITY_API_KEY");
}

export function isPerplexityConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim());
}

export function getPerplexityApiModel() {
  const value = process.env.PERPLEXITY_API_MODEL?.trim();
  return value && value.length > 0 ? value : PERPLEXITY_API_MODEL_DEFAULT;
}

export function shouldSkipPerplexityInAnalysisCycle() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.SUPPGO_CYCLE_SKIP_PERPLEXITY === "true";
}

/**
 * Default: Perplexity web-grounded influencer discovery (no SocialFetch).
 * Opt into the legacy OpenAI + SocialFetch path with
 * SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY=true.
 * Older installs may set SUPPGO_INFLUENCER_USE_PERPLEXITY=false for the same effect.
 */
export function shouldUsePerplexityForInfluencerDiscovery() {
  if (process.env.SUPPGO_INFLUENCER_USE_PERPLEXITY === "false") {
    return false;
  }

  if (process.env.SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY === "true") {
    return false;
  }

  return true;
}

export function getInfluencerDiscoveryBackend(): "perplexity" | "socialfetch" {
  return shouldUsePerplexityForInfluencerDiscovery() ? "perplexity" : "socialfetch";
}

export function getResendApiKey() {
  return getEnv("RESEND_API_KEY");
}

export function getUpstashRedisRestUrl() {
  return getEnv("UPSTASH_REDIS_REST_URL");
}

export function getUpstashRedisRestToken() {
  return getEnv("UPSTASH_REDIS_REST_TOKEN");
}

export function isUpstashConfigured() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token && url.startsWith("https://"));
}

export function isSuppgoTestModeEnabled() {
  const explicitValue = process.env.SUPPGO_TEST_MODE;

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getSuppgoTestModePromptExecutionCap() {
  const explicitCap = parsePositiveInteger(process.env.SUPPGO_TEST_MODE_PROMPT_EXECUTIONS);

  if (explicitCap) {
    return explicitCap;
  }

  return 10;
}

export function shouldForceSuppgoTestModeCategoryCoverage() {
  const explicitValue = process.env.SUPPGO_TEST_MODE_FORCE_CATEGORY_COVERAGE;

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  // Default on: keeps all prompt categories represented in TEST_MODE
  // unless explicitly disabled via env var.
  return true;
}

export function getInfluencerProviderMode() {
  const value = process.env.INFLUENCER_PROVIDER_MODE;

  if (value === "current_only" || value === "hybrid_socialfetch" || value === "socialfetch_primary") {
    return value;
  }

  return "current_only";
}

export function getSocialFetchApiKey() {
  return process.env.SOCIALFETCH_API_KEY?.trim() ?? "";
}

export function isSocialFetchConfigured() {
  return getSocialFetchApiKey().length > 0;
}

export function getInfluencerDiscoveryMaxSocialFetchLookups() {
  return parsePositiveInteger(process.env.SUPPGO_INFLUENCER_SF_MAX_LOOKUPS) ?? 24;
}

export function getInfluencerDiscoveryStopAfterVerified() {
  return parsePositiveInteger(process.env.SUPPGO_INFLUENCER_SF_STOP_AFTER_VERIFIED) ?? 8;
}

export function shouldUseStaticInfluencerHandlePool() {
  return process.env.SUPPGO_INFLUENCER_USE_STATIC_HANDLE_POOL === "true";
}

/** When using Perplexity discovery, optionally re-check each handle + follower floor via SocialFetch (uses API credits). */
export function shouldVerifyPerplexityCandidatesWithSocialFetch() {
  return isSocialFetchConfigured() && process.env.SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH === "true";
}
