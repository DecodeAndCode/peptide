import "server-only";
import type { InfluencerPlatform } from "@/types";
import { getSocialFetchApiKey } from "@/lib/supabase/env";

const ERROR_BODY_LOG_MAX_CHARS = 400;

interface SocialFetchProfileResponse {
  username?: string;
  display_name?: string;
  full_name?: string;
  follower_count?: number;
  verified?: boolean;
  is_verified?: boolean;
  bio?: string;
  biography?: string;
}

export type SocialFetchProfileSnapshot = {
  handle: string;
  displayName: string | null;
  followerCount: number | null;
  verified: boolean | null;
  bio: string | null;
};

export type SocialFetchProfileLookupResult =
  | { ok: true; snapshot: SocialFetchProfileSnapshot }
  | {
      ok: false;
      reason: "missing_key" | "not_found" | "http_error";
      httpStatus?: number;
      bodySnippet?: string;
    };

function getPlatformPath(platform: InfluencerPlatform) {
  return platform === "instagram" ? "instagram" : "tiktok";
}

function normalizePayload(
  handle: string,
  payload: SocialFetchProfileResponse,
): SocialFetchProfileSnapshot {
  const normalizedHandle = (payload.username ?? handle).replace(/^@+/, "").toLowerCase();

  return {
    handle: normalizedHandle,
    displayName: payload.display_name ?? payload.full_name ?? null,
    followerCount:
      typeof payload.follower_count === "number" && Number.isFinite(payload.follower_count)
        ? payload.follower_count
        : null,
    verified:
      typeof payload.verified === "boolean"
        ? payload.verified
        : typeof payload.is_verified === "boolean"
          ? payload.is_verified
          : null,
    bio: payload.bio ?? payload.biography ?? null,
  };
}

/**
 * Resolved profile from SocialFetch, or failure with optional HTTP meta for quotas / auth.
 */
export async function fetchSocialFetchProfileResult(
  platform: InfluencerPlatform,
  handle: string,
): Promise<SocialFetchProfileLookupResult> {
  const apiKey = getSocialFetchApiKey();
  if (!apiKey) {
    return { ok: false, reason: "missing_key" };
  }

  const platformPath = getPlatformPath(platform);
  const encodedHandle = encodeURIComponent(handle.replace(/^@+/, ""));
  const urls = [
    `https://api.socialfetch.dev/v1/${platformPath}/profiles/${encodedHandle}`,
    `https://api.socialfetch.dev/v1/${platformPath}/profile?handle=${encodedHandle}`,
  ];

  let lastHttpFailure: { status: number; bodySnippet: string } | undefined;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const raw = await response.text();
        const bodySnippet =
          raw.length > ERROR_BODY_LOG_MAX_CHARS ? `${raw.slice(0, ERROR_BODY_LOG_MAX_CHARS)}…` : raw;
        lastHttpFailure = { status: response.status, bodySnippet };
        continue;
      }

      const payload = (await response.json()) as SocialFetchProfileResponse;
      return { ok: true, snapshot: normalizePayload(handle, payload) };
    } catch {
      continue;
    }
  }

  if (lastHttpFailure) {
    console.error("[socialfetch]", {
      platform,
      handle,
      status: lastHttpFailure.status,
      bodySnippet: lastHttpFailure.bodySnippet,
    });
    return {
      ok: false,
      reason: "http_error",
      httpStatus: lastHttpFailure.status,
      bodySnippet: lastHttpFailure.bodySnippet,
    };
  }

  return { ok: false, reason: "not_found" };
}

export async function fetchSocialFetchProfile(
  platform: InfluencerPlatform,
  handle: string,
): Promise<SocialFetchProfileSnapshot | null> {
  const result = await fetchSocialFetchProfileResult(platform, handle);
  return result.ok ? result.snapshot : null;
}
