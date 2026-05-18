export type SubscriptionTier = "starter" | "growth" | "pro";
export type SubscriptionStatus = "trial" | "active" | "cancelled";
export type CycleStatus = "pending" | "running" | "complete" | "failed";
export type InfluencerPlatform = "instagram" | "tiktok";
export type InfluencerFollowerRange = "micro_10k_50k" | "mid_50k_200k" | "macro_200k+";
export type InfluencerVerificationStatus = "grounded" | "low_confidence";
export type InfluencerOutreachStatus =
  | "not_contacted"
  | "contacted"
  | "responded"
  | "partnered"
  | "archived";
export type PromptCategory =
  | "explicit_recommendation"
  | "problem_solution"
  | "ingredient_education"
  | "product_interaction";
export type PromptModel = "gpt-4o" | "claude-sonnet" | "perplexity-sonar-pro";
export type GeneratedContentType = "faq_snippet" | "product_interaction" | "llms_txt";
export type PromptSentiment =
  | "positive"
  | "neutral"
  | "negative"
  | "not_mentioned"
  | "model_refused";

export interface MarketingMetric {
  label: string;
  value: string;
  delay?: string;
}

export interface MarketingPlan {
  name: string;
  tier: SubscriptionTier;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
  description?: string;
}

export interface BrandRecord {
  id: string;
  user_id: string;
  brand_name: string;
  brand_aliases: string[];
  website_url: string;
  industry_tags: string[];
  competitor_urls: string[];
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface CycleRecord {
  id: string;
  brand_id: string;
  status: CycleStatus;
  cycle_number: number;
  models_queried: string[];
  total_prompts: number | null;
  mention_count: number | null;
  visibility_score: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PromptRecord {
  id: string;
  cycle_id: string;
  brand_id: string;
  prompt_text: string;
  prompt_category: PromptCategory;
  model: PromptModel;
  raw_response: string;
  citation_urls: string[];
  brand_mentioned: boolean;
  mention_rank: number | null;
  mention_context: string | null;
  competitors_mentioned: string[];
  sentiment: PromptSentiment | null;
  created_at: string;
}

export interface GeneratedContentRecord {
  id: string;
  brand_id: string;
  cycle_id: string | null;
  content_type: GeneratedContentType;
  title: string | null;
  body: string;
  target_prompts: string[];
  medical_sources: string[];
  created_at: string;
}

export interface InfluencerMatchRecord {
  id: string;
  brand_id: string;
  cycle_id: string | null;
  platform: InfluencerPlatform;
  handle: string;
  display_name: string | null;
  follower_range: InfluencerFollowerRange | null;
  niche_tags: string[];
  match_reason: string | null;
  outreach_message: string | null;
  source_urls: string[];
  fit_score: number | null;
  verification_status: InfluencerVerificationStatus | null;
  verification_confidence: number | null;
  outreach_status: InfluencerOutreachStatus | null;
  outreach_notes: string | null;
  last_outreach_at: string | null;
  shown_in_cycle: number[];
  created_at: string;
}

export interface ReportRecord {
  id: string;
  brand_id: string;
  cycle_id: string;
  storage_path: string;
  is_ready: boolean;
  emailed_at: string | null;
  created_at: string;
}

// --- Integrations ---

export type IntegrationType = "github";
export type IntegrationStatus = "active" | "error" | "disconnected";
export type ContentDeploymentStatus = "pending" | "deployed" | "failed";

export interface GitHubCredentials {
  access_token_enc: string; // AES-256-GCM encrypted access token
  repo_full_name: string | null; // e.g. "owner/my-site"
  content_dir: string | null; // e.g. "content/pages"
}

export interface IntegrationRecord {
  id: string;
  brand_id: string;
  integration_type: IntegrationType;
  credentials: GitHubCredentials;
  status: IntegrationStatus;
  last_sync_at: string | null;
  created_at: string;
}

// Safe shape sent to client components — no token
export interface GitHubIntegrationStatus {
  connected: boolean;
  repo_full_name: string | null;
  content_dir: string | null;
  status: IntegrationStatus;
}

export interface ContentDeploymentRecord {
  id: string;
  content_id: string;
  brand_id: string;
  integration_type: IntegrationType;
  external_url: string | null;
  status: ContentDeploymentStatus;
  deployed_at: string | null;
  created_at: string;
}

// --- Prompt helpers ---

export interface PromptDefinition {
  promptText: string;
  promptCategory: PromptCategory;
}

export interface PromptAnalysisResult {
  promptText: string;
  promptCategory: PromptCategory;
  model: PromptModel;
  rawResponse: string;
  citationUrls: string[];
  brandMentioned: boolean;
  mentionRank: number | null;
  mentionContext: string | null;
  competitorsMentioned: string[];
  sentiment: PromptSentiment;
  visibilityScore: number;
}

export interface SiteAnalysisContentSignals {
  brandAliases: string[];
  productNames: string[];
  ingredients: string[];
  healthClaims: string[];
  faqTopics: string[];
  topicKeywords: string[];
}

export interface SiteAnalysisRecord {
  id: string;
  brand_id: string;
  crawled_at: string;
  pages_analyzed: number | null;
  has_llms_txt: boolean;
  llms_txt_content: string | null;
  has_schema_markup: boolean;
  javascript_rendering_issues: string[];
  content_signals: SiteAnalysisContentSignals | null;
  missing_content_gaps: string[];
  recommendations: string[];
}

export interface CycleRunSummary {
  cycleId: string;
  cycleNumber: number;
  totalPromptTemplates: number;
  totalPromptExecutions: number;
  modelsQueried: PromptModel[];
  mentionCount: number;
  visibilityScore: number;
  testModeApplied: boolean;
}

export interface IndustryOption {
  label: string;
  value: string;
}
