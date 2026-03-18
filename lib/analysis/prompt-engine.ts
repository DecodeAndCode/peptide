import "server-only";
import { INDUSTRY_GAP_KEYWORDS, getTierAnalysisConfig } from "@/lib/suppgo";
import type {
  BrandRecord,
  PromptCategory,
  PromptDefinition,
  SiteAnalysisRecord,
  SiteAnalysisContentSignals,
  SubscriptionTier,
} from "@/types";

const INDUSTRY_RECOMMENDATION_SEEDS: Record<string, string[]> = {
  vitamins_minerals: ["magnesium supplements", "multivitamins", "vitamin D brands"],
  protein_performance: ["protein powders", "creatine supplements", "pre-workout formulas"],
  nootropics_cognitive: ["nootropic supplements", "focus supplements", "brain health supplements"],
  adaptogens: ["adaptogen blends", "stress support supplements", "ashwagandha supplements"],
  greens_superfoods: ["greens powders", "daily wellness greens", "superfood blends"],
  peptides_topical_cosmetic: ["peptide serums", "skin barrier creams", "anti-aging skincare products"],
  weight_management: ["metabolism support supplements", "appetite support supplements", "weight management formulas"],
  gut_health: ["probiotic supplements", "gut health supplements", "digestive support formulas"],
  sleep_recovery: ["sleep supplements", "recovery supplements", "magnesium sleep formulas"],
  womens_health: ["women's wellness supplements", "hormone support supplements", "menopause support formulas"],
  mens_health: ["men's health supplements", "performance support supplements", "vitality supplements"],
  general_wellness: ["daily wellness supplements", "longevity supplements", "immune support supplements"],
};

const INDUSTRY_PROBLEM_SEEDS: Record<string, string[]> = {
  vitamins_minerals: ["better sleep", "daily energy", "immune support"],
  protein_performance: ["post-workout soreness", "muscle recovery", "training performance"],
  nootropics_cognitive: ["focus and concentration", "mental clarity", "brain fog"],
  adaptogens: ["stress and cortisol", "feeling overwhelmed", "better stress resilience"],
  greens_superfoods: ["better digestion", "daily nutrient coverage", "more consistent energy"],
  peptides_topical_cosmetic: ["skin elasticity", "fine lines", "dull skin"],
  weight_management: ["metabolism support", "cravings", "weight loss plateaus"],
  gut_health: ["bloating", "irregular digestion", "microbiome support"],
  sleep_recovery: ["falling asleep faster", "better recovery", "restless nights"],
  womens_health: ["hormone support", "menopause symptoms", "cycle support"],
  mens_health: ["energy and vitality", "performance support", "healthy aging for men"],
  general_wellness: ["more daily energy", "healthy aging", "overall wellness"],
};

const GENERIC_INTERACTION_PAIRS = [
  "magnesium and ashwagandha",
  "creatine and pre-workout",
  "collagen and vitamin C",
  "lion's mane and rhodiola",
  "NMN and NAD+",
  "greens powder and probiotics",
];

const CATEGORY_TEMPLATE_MAP: Record<PromptCategory, string[]> = {
  explicit_recommendation: [
    "What are the best {seed} right now?",
    "Which {seed} brand do you recommend currently?",
    "Top {seed} for daily use right now?",
    "Best {seed} according to current expert opinion?",
  ],
  problem_solution: [
    "What supplements help with {seed}?",
    "How can I improve {seed} naturally?",
    "What should I take for {seed}?",
    "What is the best supplement approach for {seed} currently?",
  ],
  ingredient_education: [
    "What does {seed} actually do?",
    "How does {seed} work?",
    "Is {seed} safe for long-term use?",
    "What should I know before taking {seed}?",
  ],
  product_interaction: [
    "Can I take {seed} together?",
    "Is it safe to combine {seed}?",
    "How do {seed} work together?",
    "What should I know about using {seed} in the same stack?",
  ],
};

function dedupe(items: string[], limit = 500) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function normalizeTopic(topic: string) {
  return topic.replace(/\b20\d{2}\b/g, "right now").replace(/\?+$/, "").replace(/\s+/g, " ").trim();
}

function pairItems(items: string[], limit = 80) {
  const pairs: string[] = [];

  for (let index = 0; index < items.length; index += 1) {
    for (let secondIndex = index + 1; secondIndex < items.length; secondIndex += 1) {
      pairs.push(`${items[index]} and ${items[secondIndex]}`);

      if (pairs.length >= limit) {
        return pairs;
      }
    }
  }

  return pairs;
}

function extractDomainName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0]?.replace(/[-_]/g, " ") ?? "";
  } catch {
    return "";
  }
}

function normalizeDisplayName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getHeroProductNames(contentSignals: SiteAnalysisContentSignals | null) {
  return dedupe(contentSignals?.productNames ?? [], 12).filter(
    (name) =>
      name.length >= 2 &&
      name.length <= 40 &&
      !name.includes("?") &&
      !/[.!]/.test(name) &&
      name.split(/\s+/).length <= 5,
  );
}

function getTierFullCoverageCount(tier: SubscriptionTier, selectedCount: number) {
  if (tier === "starter") {
    return Math.min(2, selectedCount);
  }

  if (tier === "growth") {
    return Math.min(4, selectedCount);
  }

  return selectedCount;
}

function getMinimalCoveragePerIndustry(tier: SubscriptionTier) {
  if (tier === "starter") {
    return 1;
  }

  if (tier === "growth") {
    return 2;
  }

  return 0;
}

function getTopHealthGoals(contentSignals: SiteAnalysisContentSignals | null) {
  const healthClaimGoals = (contentSignals?.healthClaims ?? [])
    .flatMap((claim) =>
      claim
        .replace(/\b(?:supports?|helps?|improves?|boosts?|promotes?|designed for)\b/gi, "")
        .split(/[,/]| and /i),
    )
    .map(normalizeTopic)
    .map((goal) => goal.replace(/^(?:for|like|the|and|or|to|with)\s+/i, ""))
    .map((goal) => goal.replace(/[.]+$/g, ""))
    .filter((goal) => goal.length >= 4 && goal.length <= 40 && !goal.includes("?"));

  const fallbackGoals = (contentSignals?.faqTopics ?? [])
    .map(normalizeTopic)
    .filter((goal) => !goal.includes("?"))
    .slice(0, 3);

  return dedupe([...healthClaimGoals, ...fallbackGoals], 8);
}

function getIndustrySignalWeights({
  contentSignals,
  industryTags,
}: {
  contentSignals: SiteAnalysisContentSignals | null;
  industryTags: string[];
}) {
  const signalText = [
    ...(contentSignals?.productNames ?? []),
    ...(contentSignals?.ingredients ?? []),
    ...(contentSignals?.healthClaims ?? []),
    ...(contentSignals?.faqTopics ?? []),
    ...(contentSignals?.topicKeywords ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return Object.fromEntries(
    industryTags.map((tag) => {
      const keywords = dedupe([
        ...(INDUSTRY_GAP_KEYWORDS[tag] ?? []),
        ...(INDUSTRY_RECOMMENDATION_SEEDS[tag] ?? []),
        ...(INDUSTRY_PROBLEM_SEEDS[tag] ?? []),
      ]);
      const score =
        keywords.reduce((sum, keyword) => sum + (signalText.includes(keyword.toLowerCase()) ? 1 : 0), 0) || 1;

      return [tag, score];
    }),
  ) as Record<string, number>;
}

function buildRecommendationSeeds({
  tag,
  contentSignals,
}: {
  tag: string;
  contentSignals: SiteAnalysisContentSignals | null;
}) {
  return dedupe([
    ...(INDUSTRY_RECOMMENDATION_SEEDS[tag] ?? []),
    ...(contentSignals?.productNames ?? []),
    ...(contentSignals?.ingredients ?? []).map((ingredient) => `${ingredient} supplements`),
    ...(contentSignals?.topicKeywords ?? []).map((keyword) => `${normalizeTopic(keyword)} supplements`),
  ]);
}

function buildProblemSeeds({
  tag,
  contentSignals,
}: {
  tag: string;
  contentSignals: SiteAnalysisContentSignals | null;
}) {
  return dedupe([
    ...(INDUSTRY_PROBLEM_SEEDS[tag] ?? []),
    ...getTopHealthGoals(contentSignals),
    ...(contentSignals?.topicKeywords ?? []).map((keyword) => `better ${normalizeTopic(keyword)}`),
  ]);
}

function buildEducationSeeds({
  tag,
  contentSignals,
}: {
  tag: string;
  contentSignals: SiteAnalysisContentSignals | null;
}) {
  return dedupe([
    ...(contentSignals?.ingredients ?? []),
    ...(contentSignals?.productNames ?? []),
    ...(INDUSTRY_GAP_KEYWORDS[tag] ?? []),
    ...(contentSignals?.topicKeywords ?? []),
  ]);
}

function buildInteractionSeeds(contentSignals: SiteAnalysisContentSignals | null) {
  return dedupe([
    ...pairItems(dedupe([...(contentSignals?.ingredients ?? []), ...(contentSignals?.productNames ?? [])], 16)),
    ...GENERIC_INTERACTION_PAIRS,
  ]);
}

function buildPromptDefinitions(category: PromptCategory, seeds: string[]) {
  return dedupe(
    seeds.flatMap((seed) =>
      CATEGORY_TEMPLATE_MAP[category].map((template) => template.replaceAll("{seed}", normalizeTopic(seed))),
    ),
  ).map((promptText) => ({
    promptText,
    promptCategory: category,
  }));
}

function serializePrompt(definition: PromptDefinition) {
  return `${definition.promptCategory}::${definition.promptText}`;
}

function deserializePrompt(entry: string) {
  const [promptCategory, ...promptTextParts] = entry.split("::");
  return {
    promptCategory: promptCategory as PromptCategory,
    promptText: promptTextParts.join("::"),
  };
}

function allocateCounts(total: number, weights: Array<{ key: string; weight: number }>, minPerKey = 0) {
  if (weights.length === 0 || total <= 0) {
    return {} as Record<string, number>;
  }

  const allocations = Object.fromEntries(weights.map(({ key }) => [key, minPerKey])) as Record<string, number>;
  let remaining = Math.max(0, total - minPerKey * weights.length);
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0) || weights.length;

  weights.forEach(({ key, weight }) => {
    if (remaining <= 0) {
      return;
    }

    const share = Math.floor((remaining * weight) / totalWeight);
    allocations[key] += share;
  });

  let assigned = Object.values(allocations).reduce((sum, count) => sum + count, 0);
  let index = 0;

  while (assigned < total) {
    allocations[weights[index % weights.length].key] += 1;
    assigned += 1;
    index += 1;
  }

  return allocations;
}

function buildHeroPrompts({
  brand,
  contentSignals,
}: {
  brand: BrandRecord;
  contentSignals: SiteAnalysisContentSignals | null;
}) {
  const competitorNames = dedupe(brand.competitor_urls.map(extractDomainName))
    .filter((name) => name.length >= 2)
    .map(normalizeDisplayName);
  const healthGoals = getTopHealthGoals(contentSignals);
  const productNames = getHeroProductNames(contentSignals);
  const brandSeed = brand.brand_name;
  const heroPrompts: PromptDefinition[] = [
    { promptCategory: "explicit_recommendation", promptText: `Is ${brandSeed} worth it?` },
    {
      promptCategory: "explicit_recommendation",
      promptText: `How does ${brandSeed} compare to competitors?`,
    },
    {
      promptCategory: "explicit_recommendation",
      promptText: `What are people saying about ${brandSeed}?`,
    },
    ...healthGoals.map((goal) => ({
      promptCategory: "problem_solution" as const,
      promptText: `Is ${brandSeed} good for ${goal}?`,
    })),
    ...competitorNames.map((competitorName) => ({
      promptCategory: "explicit_recommendation" as const,
      promptText: `${brandSeed} vs ${competitorName} - which is better?`,
    })),
    ...productNames.flatMap((productName) => [
      {
        promptCategory: "explicit_recommendation" as const,
        promptText: `Is ${productName} from ${brandSeed} worth it?`,
      },
      {
        promptCategory: "problem_solution" as const,
        promptText: `Is ${productName} from ${brandSeed} good for ${healthGoals[0] ?? "daily wellness"}?`,
      },
    ]),
  ];

  return dedupe(heroPrompts.map(serializePrompt), 500).map((entry) => {
    const [promptCategory, ...promptTextParts] = entry.split("::");
    return {
      promptCategory: promptCategory as PromptCategory,
      promptText: promptTextParts.join("::"),
    };
  });
}

function buildIndustryPromptPool({
  tag,
  contentSignals,
}: {
  tag: string;
  contentSignals: SiteAnalysisContentSignals | null;
}) {
  const categories: Record<PromptCategory, PromptDefinition[]> = {
    explicit_recommendation: buildPromptDefinitions(
      "explicit_recommendation",
      buildRecommendationSeeds({ tag, contentSignals }),
    ),
    problem_solution: buildPromptDefinitions("problem_solution", buildProblemSeeds({ tag, contentSignals })),
    ingredient_education: buildPromptDefinitions(
      "ingredient_education",
      buildEducationSeeds({ tag, contentSignals }),
    ),
    product_interaction: buildPromptDefinitions(
      "product_interaction",
      buildInteractionSeeds(contentSignals),
    ),
  };

  const ordered: PromptDefinition[] = [];
  let index = 0;
  const categoryOrder: PromptCategory[] = [
    "explicit_recommendation",
    "problem_solution",
    "ingredient_education",
    "product_interaction",
  ];

  while (ordered.length < Object.values(categories).reduce((sum, items) => sum + items.length, 0)) {
    let added = false;

    categoryOrder.forEach((category) => {
      const definition = categories[category][index];

      if (definition) {
        ordered.push(definition);
        added = true;
      }
    });

    if (!added) {
      break;
    }

    index += 1;
  }

  return ordered;
}

function interleavePromptPools(heroPrompts: PromptDefinition[], corePrompts: PromptDefinition[], total: number) {
  const ordered: PromptDefinition[] = [];
  let heroIndex = 0;
  let coreIndex = 0;

  while (ordered.length < total && (heroIndex < heroPrompts.length || coreIndex < corePrompts.length)) {
    const expectedHeroCount = Math.round(((ordered.length + 1) * heroPrompts.length) / total);

    if (heroIndex < heroPrompts.length && heroIndex < expectedHeroCount) {
      ordered.push(heroPrompts[heroIndex]);
      heroIndex += 1;
      continue;
    }

    if (coreIndex < corePrompts.length) {
      ordered.push(corePrompts[coreIndex]);
      coreIndex += 1;
      continue;
    }

    if (heroIndex < heroPrompts.length) {
      ordered.push(heroPrompts[heroIndex]);
      heroIndex += 1;
    }
  }

  return ordered;
}

export function generatePromptLibrary({
  brand,
  siteAnalysis,
}: {
  brand: BrandRecord;
  siteAnalysis: SiteAnalysisRecord | null;
}) {
  const config = getTierAnalysisConfig(brand.subscription_tier);
  const contentSignals = siteAnalysis?.content_signals ?? null;
  const totalPromptBudget = config.promptTemplatesPerCycle;
  const heroPromptBudget = Math.max(1, Math.floor(totalPromptBudget * 0.2));
  const corePromptBudget = Math.max(0, totalPromptBudget - heroPromptBudget);
  const heroPrompts = buildHeroPrompts({
    brand,
    contentSignals,
  });

  const industrySignalWeights = getIndustrySignalWeights({
    contentSignals,
    industryTags: brand.industry_tags,
  });
  const rankedIndustryTags = [...brand.industry_tags].sort(
    (left, right) =>
      (industrySignalWeights[right] ?? 1) - (industrySignalWeights[left] ?? 1) || left.localeCompare(right),
  );
  const fullCoverageCount = getTierFullCoverageCount(config.tier, rankedIndustryTags.length);
  const fullCoverageTags = rankedIndustryTags.slice(0, fullCoverageCount);
  const minimalCoverageTags = rankedIndustryTags.slice(fullCoverageCount);
  const minimalCoveragePerIndustry = getMinimalCoveragePerIndustry(config.tier);
  const minimalCoverageBudget = Math.min(
    corePromptBudget,
    minimalCoverageTags.length * minimalCoveragePerIndustry,
  );
  const fullCoverageBudget = Math.max(0, corePromptBudget - minimalCoverageBudget);
  const fullCoverageAllocations = allocateCounts(
    fullCoverageBudget,
    fullCoverageTags.map((tag) => ({
      key: tag,
      weight: industrySignalWeights[tag] ?? 1,
    })),
    fullCoverageTags.length > 0 ? 4 : 0,
  );

  const corePrompts = [
    ...fullCoverageTags.flatMap((tag) =>
      buildIndustryPromptPool({
        tag,
        contentSignals,
      }).slice(0, fullCoverageAllocations[tag] ?? 0),
    ),
    ...minimalCoverageTags.flatMap((tag) =>
      buildIndustryPromptPool({
        tag,
        contentSignals,
      }).slice(0, minimalCoveragePerIndustry),
    ),
  ];
  const orderedSelection = interleavePromptPools(
    heroPrompts.slice(0, heroPromptBudget),
    corePrompts,
    totalPromptBudget,
  );
  const selectedKeys = new Set(orderedSelection.map(serializePrompt));
  const fallbackPool = dedupe(
    [
      ...heroPrompts,
      ...rankedIndustryTags.flatMap((tag) =>
        buildIndustryPromptPool({
          tag,
          contentSignals,
        }),
      ),
    ].map(serializePrompt),
    2000,
  ).filter((entry) => !selectedKeys.has(entry));
  const combined = [...selectedKeys, ...fallbackPool].slice(0, totalPromptBudget);

  return combined.map(deserializePrompt);
}
