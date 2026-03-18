import type { IndustryOption, MarketingPlan, PromptCategory, PromptModel, SubscriptionTier } from "@/types";

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

export const SUBSCRIPTION_PLANS: MarketingPlan[] = [
  {
    name: "Starter",
    tier: "starter",
    price: "$49",
    period: "per month",
    description: "A reliable single-model baseline for early-stage visibility tracking.",
    features: [
      "Monthly analysis cycle",
      "GPT-4o monitoring",
      "50 prompts per cycle",
      "llms.txt and FAQ guidance",
      "Downloadable report access",
    ],
  },
  {
    name: "Growth",
    tier: "growth",
    price: "$149",
    period: "per month",
    description:
      "Cross-model benchmarking with higher prompt volume for growing consumer health brands.",
    featured: true,
    features: [
      "Bi-weekly analysis cycles",
      "GPT-4o and Claude monitoring",
      "150 prompts per cycle",
      "Competitor benchmarking",
      "Product interaction content generation",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$349",
    period: "per month",
    description:
      "The fullest view, including Perplexity's search-grounded perspective and widest prompt coverage.",
    features: [
      "Weekly analysis cycles",
      "GPT-4o, Claude, and Perplexity",
      "400+ prompts per cycle",
      "Influencer matching module",
      "Citation-backed intelligence",
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

export function getSubscriptionPlan(tier: MarketingPlan["tier"]) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.tier === tier) ?? SUBSCRIPTION_PLANS[0];
}

export function getTierAnalysisConfig(tier: SubscriptionTier) {
  return TIER_ANALYSIS_CONFIG[tier];
}
