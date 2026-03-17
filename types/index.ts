export type SubscriptionTier = "starter" | "growth" | "pro";
export type SubscriptionStatus = "trial" | "active" | "cancelled";
export type CycleStatus = "pending" | "running" | "complete" | "failed";

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

export interface SiteAnalysisContentSignals {
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

export interface IndustryOption {
  label: string;
  value: string;
}
