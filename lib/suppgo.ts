import type {
  GeneratedContentType,
  IndustryOption,
  MarketingPlan,
  PromptCategory,
  PromptModel,
  SubscriptionTier,
} from "@/types";

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { label: "Vitamins & Minerals", value: "vitamins_minerals" },
  { label: "Protein & Performance", value: "protein_performance" },
  { label: "Nootropics & Cognitive", value: "nootropics_cognitive" },
  { label: "Adaptogens", value: "adaptogens" },
  { label: "Greens & Superfoods", value: "greens_superfoods" },
  { label: "Peptides (Topical/Cosmetic)", value: "peptides_topical_cosmetic" },
  { label: "Weight Management", value: "weight_management" },
  { label: "Gut Health", value: "gut_health" },
  { label: "Sleep & Recovery", value: "sleep_recovery" },
  { label: "Women's Health", value: "womens_health" },
  { label: "Men's Health", value: "mens_health" },
  { label: "General Wellness", value: "general_wellness" },
];

/** Tier stored on new signups / trials while product is single-surface (former Pro). */
export const DEFAULT_TRIAL_SUBSCRIPTION_TIER = "pro" as const satisfies SubscriptionTier;

/**
 * Single public offering: full product for every account during early access.
 * Tier pickers were removed from marketing and auth; `tier` stays `pro` for API compatibility.
 */
export const SUBSCRIPTION_PLANS: MarketingPlan[] = [
  {
    name: "SuppGo",
    tier: "pro",
    price: "Free trial",
    period: "14-day trial",
    featured: true,
    description:
      "See where your brand appears when shoppers ask AI about supplements and wellness, where rivals win the recommendation, and what to publish next—without wading through model names or engineering jargon.",
    features: [
      "Gain visibility across all major AI models, the same ones your customers use to research health & wellness",
      "Broad coverage of realistic prompts—discover questions your customers are asking AI and ensure you're in the answers they get",
      "Clear competitor gap views—see who gets cited instead of you, on which topics, and win back those citations",
      "Draft FAQs and education-style content—we give you the targeted content you need to boost visibility in the right places",
      "Curated influencer matching—find creators who are a perfect match for your brand and connect with them in one click",
      "Live dashboard plus PDF reports your team can share—you'll always know where your visibility stands",
    ],
  },
];

export interface TierAnalysisConfig {
  tier: SubscriptionTier;
  promptTemplatesPerCycle: number;
  models: PromptModel[];
  competitorBenchmarking: boolean;
  productInteractionContent: boolean;
  influencerMatching: boolean;
}

export const TIER_ANALYSIS_CONFIG: Record<SubscriptionTier, TierAnalysisConfig> = {
  starter: {
    tier: "starter",
    promptTemplatesPerCycle: 50,
    models: ["gpt-4o"],
    competitorBenchmarking: false,
    productInteractionContent: false,
    influencerMatching: false,
  },
  growth: {
    tier: "growth",
    promptTemplatesPerCycle: 150,
    models: ["gpt-4o", "claude-sonnet"],
    competitorBenchmarking: true,
    productInteractionContent: true,
    influencerMatching: false,
  },
  pro: {
    tier: "pro",
    promptTemplatesPerCycle: 420,
    models: ["gpt-4o", "claude-sonnet", "perplexity-sonar-pro"],
    competitorBenchmarking: true,
    productInteractionContent: true,
    influencerMatching: true,
  },
};

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  explicit_recommendation: "Explicit Recommendation",
  problem_solution: "Problem Solution",
  ingredient_education: "Ingredient Education",
  product_interaction: "Product Interaction",
};

/** Human-facing draft types plus one-line “why this draft exists” for cards and reports. */
export const GENERATED_CONTENT_DISPLAY: Record<
  GeneratedContentType,
  { label: string; rationale: string }
> = {
  product_interaction: {
    label: "Ingredient interactions",
    rationale:
      "From missed “can I take this with that?” prompts—longer, safety-aware copy for stacks and ingredient combos.",
  },
  faq_snippet: {
    label: "FAQ snippet",
    rationale:
      "From other missed prompts (recommendations, problems, education)—a concise publishable Q&A to win those answers.",
  },
  llms_txt: {
    label: "Brand context file",
    rationale:
      "Machine-readable summary of your brand, products, and claims—helps assistants and crawlers cite you consistently.",
  },
};

export function getGeneratedContentDisplay(type: GeneratedContentType) {
  return GENERATED_CONTENT_DISPLAY[type];
}

export const PROMPT_CATEGORY_WEIGHTS: Record<PromptCategory, number> = {
  explicit_recommendation: 1,
  problem_solution: 1,
  ingredient_education: 0.75,
  product_interaction: 0.8,
};

export const INDUSTRY_GAP_KEYWORDS: Record<string, string[]> = {
  vitamins_minerals: ["vitamin", "mineral", "magnesium", "vitamin d", "multivitamin"],
  protein_performance: ["protein", "creatine", "pre-workout", "recovery", "performance"],
  nootropics_cognitive: ["focus", "cognitive", "nootropic", "brain", "productivity"],
  adaptogens: ["adaptogen", "stress", "cortisol", "ashwagandha", "rhodiola"],
  greens_superfoods: ["greens", "superfood", "gut health", "fiber", "daily wellness"],
  peptides_topical_cosmetic: ["peptide", "skin", "topical", "cosmetic", "ghk-cu"],
  weight_management: ["weight", "metabolism", "appetite", "glp-1", "fat loss"],
  gut_health: ["gut", "digestion", "microbiome", "bloating", "probiotic"],
  sleep_recovery: ["sleep", "recovery", "rest", "melatonin", "magnesium"],
  womens_health: ["women", "cycle", "hormone", "menopause", "prenatal"],
  mens_health: ["men", "testosterone", "performance", "muscle", "vitality"],
  general_wellness: ["wellness", "daily health", "longevity", "energy", "immune"],
};

export function getIndustryLabel(value: string) {
  return INDUSTRY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getSubscriptionPlan(_tier: MarketingPlan["tier"]) {
  return SUBSCRIPTION_PLANS[0];
}

/**
 * Returns the effective analysis config for a brand.
 *
 * Tier gating is removed while there are no paying customers — every brand
 * runs on the former Pro config (all models, all content types, influencer
 * matching). The `tier` argument is accepted for interface compatibility but
 * has no effect on the returned config.
 */
export function getTierAnalysisConfig(_tier: SubscriptionTier): TierAnalysisConfig {
  return TIER_ANALYSIS_CONFIG["pro"];
}
