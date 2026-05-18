import type {
  BrandRecord,
  CycleRecord,
  InfluencerPlatform,
  InfluencerVerificationStatus,
  PromptRecord,
  SiteAnalysisRecord,
} from "@/types";

export type InfluencerProviderMode = "current_only" | "hybrid_socialfetch" | "socialfetch_primary";

export interface InfluencerProviderContext {
  brand: BrandRecord;
  cycle: CycleRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
  minFollowerCount: number;
}

// Raw candidate item discovered from a provider query response.
export interface ProviderCandidateHit {
  handle: string;
  platform: InfluencerPlatform;
  followerEstimate: string;
  topics: string[];
  sourceUrl: string | null;
  citationUrls: string[];
}

// Validated candidate shape used by scoring and persistence.
export interface DiscoveryCandidate {
  handle: string;
  platform: InfluencerPlatform;
  followerEstimate: string;
  topics: string[];
  sourceUrls: string[];
  verificationStatus: InfluencerVerificationStatus;
  verificationConfidence: number;
}

