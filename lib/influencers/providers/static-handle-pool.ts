import "server-only";
import type { InfluencerProviderContext } from "./types";
import type { InfluencerPlatform } from "@/types";

import staticPoolJson from "@/lib/influencers/data/static-influencer-handles.json";

export interface StaticPoolEntry {
  platform: InfluencerPlatform;
  handle: string;
  topics: string[];
}

type PoolFileShape = {
  defaultPoolKey: string;
  pools: Record<string, StaticPoolEntry[]>;
};

function isInfluencerPlatform(value: unknown): value is InfluencerPlatform {
  return value === "instagram" || value === "tiktok";
}

function normalizeEntry(raw: unknown): StaticPoolEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const platform = item.platform;
  const handle = typeof item.handle === "string" ? item.handle.replace(/^@+/, "").trim().toLowerCase() : "";
  const topics = Array.isArray(item.topics)
    ? item.topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
    : [];

  if (!handle || !isInfluencerPlatform(platform)) {
    return null;
  }

  return { platform, handle, topics };
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], seed: number) {
  const rand = mulberry32(seed % 2147483646 || 1);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function hashBrandId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Resolved suggestions for one refresh attempt. Expand pools in
 * `lib/influencers/data/static-influencer-handles.json` instead of GPT at refresh time.
 */
export function resolveStaticBrandHandleSuggestions(context: InfluencerProviderContext): StaticPoolEntry[] {
  const data = staticPoolJson as PoolFileShape;
  const pooled: StaticPoolEntry[] = [];

  for (const tag of context.brand.industry_tags) {
    const bucket = data.pools[tag];
    if (!bucket?.length) {
      continue;
    }

    for (const raw of bucket) {
      const entry = normalizeEntry(raw);
      if (entry) {
        pooled.push(entry);
      }
    }
  }

  if (pooled.length === 0) {
    const fallback = data.pools[data.defaultPoolKey] ?? data.pools.general_wellness ?? [];
    for (const raw of fallback) {
      const entry = normalizeEntry(raw);
      if (entry) {
        pooled.push(entry);
      }
    }
  }

  const dedupeKey = (e: StaticPoolEntry) => `${e.platform}:${e.handle}`;
  const unique = [...new Map(pooled.map((e) => [dedupeKey(e), e])).values()];

  const seed = hashBrandId(context.brand.id) + context.cycle.cycle_number * 1_000_003;
  shuffleInPlace(unique, seed);

  return unique;
}
