import "server-only";
import { isSocialFetchConfigured } from "@/lib/supabase/env";
import { fetchSocialFetchProfile } from "./socialfetch-client";
import type { DiscoveryCandidate } from "./types";

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

function getPlatformProfileUrl(platform: DiscoveryCandidate["platform"], handle: string) {
  return platform === "instagram"
    ? `https://www.instagram.com/${handle}`
    : `https://www.tiktok.com/@${handle}`;
}

export async function enrichCandidatesWithSocialFetch(
  candidates: DiscoveryCandidate[],
  minFollowerCount: number,
) {
  if (!isSocialFetchConfigured() || candidates.length === 0) {
    return candidates;
  }

  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      const profile = await fetchSocialFetchProfile(candidate.platform, candidate.handle);

      if (!profile) {
        return candidate;
      }

      const socialUrl = getPlatformProfileUrl(candidate.platform, profile.handle);
      const sourceUrls = Array.from(new Set([...candidate.sourceUrls, socialUrl]));
      const followerEstimate =
        profile.followerCount !== null ? profile.followerCount.toLocaleString() : candidate.followerEstimate;
      const topicSignals = tokenizeBio(profile.bio);
      const topics = Array.from(new Set([...candidate.topics, ...topicSignals])).slice(0, 5);

      let verificationConfidence = candidate.verificationConfidence;
      let verificationStatus = candidate.verificationStatus;

      if (profile.followerCount !== null) {
        verificationConfidence = Math.min(100, verificationConfidence + 10);
      }

      if (profile.verified) {
        verificationConfidence = Math.min(100, verificationConfidence + 8);
      }

      if ((profile.followerCount ?? 0) >= minFollowerCount) {
        verificationConfidence = Math.min(100, verificationConfidence + 5);
      }

      if (verificationConfidence >= 70) {
        verificationStatus = "grounded";
      }

      return {
        ...candidate,
        followerEstimate,
        topics,
        sourceUrls,
        verificationConfidence,
        verificationStatus,
      };
    }),
  );

  return enriched;
}

