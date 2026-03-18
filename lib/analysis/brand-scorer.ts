import "server-only";
import { WELL_KNOWN_CONSUMER_HEALTH_BRANDS } from "@/lib/analysis/consumer-health-brands";
import { classifySentimentWithHaiku, extractBrandMentionsWithHaiku } from "@/lib/llm/anthropic";
import { PROMPT_CATEGORY_WEIGHTS } from "@/lib/suppgo";
import type {
  BrandRecord,
  PromptAnalysisResult,
  PromptCategory,
  PromptModel,
  SiteAnalysisRecord,
} from "@/types";

const REFUSAL_PATTERNS = [
  /\b(?:can(?:not|'t)|unable to|won't|do not|don't)\s+(?:recommend|provide|offer|name|suggest)\s+(?:specific\s+)?(?:brands?|products?|product information)\b/i,
  /\bi (?:can(?:not|'t)|don't|do not) recommend specific (?:brands?|products?)\b/i,
  /\bunable to provide specific brand information\b/i,
  /\bi (?:can't|cannot|won't) tell you which brand is best\b/i,
];

const COMPETITOR_PRODUCT_TO_BRAND: Record<string, string> = {
  "athletic greens ag1": "Athletic Greens",
  "amazing grass green superfood": "Amazing Grass",
  "garden of life raw organic perfect food": "Garden of Life",
  "organifi green juice": "Organifi",
  "vibrant health green vibrance": "Vibrant Health",
  "green vibrance": "Vibrant Health",
};

function dedupe(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDomainName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0]?.replace(/[-_]/g, " ") ?? "";
  } catch {
    return "";
  }
}

function buildBrandSearchTerms(brand: BrandRecord, siteAnalysis: SiteAnalysisRecord | null) {
  return dedupe([
    brand.brand_name,
    brand.brand_name.replace(/[^\w\s]/g, " "),
    ...(brand.brand_aliases ?? []),
    ...(siteAnalysis?.content_signals?.brandAliases ?? []),
    extractDomainName(brand.website_url),
    ...(siteAnalysis?.content_signals?.productNames ?? []).slice(0, 8),
  ]).filter((term) => term.length >= 3);
}

function normalizeDisplayName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeCompetitorName(value: string) {
  const normalized = normalizeDisplayName(
    value
      .replace(/^[\d)\].\s*-]+/, "")
      .replace(/\*\*/g, "")
      .replace(/\s+\([^)]+\)\s*$/g, "")
      .replace(/\s+-\s+.*$/g, "")
      .trim(),
  );

  return (
    COMPETITOR_PRODUCT_TO_BRAND[normalized.toLowerCase()] ??
    normalized
  );
}

function findFirstMentionIndex(text: string, searchTerms: string[]) {
  const matches = searchTerms
    .map((term) => ({
      term,
      index: text.search(new RegExp(`\\b${escapeRegExp(term)}\\b`, "i")),
    }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index);

  return matches[0]?.index ?? -1;
}

function extractMentionContext(text: string, searchTerms: string[]) {
  const sentences = splitIntoSentences(text);
  const sentenceIndex = sentences.findIndex((sentence) =>
    searchTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(sentence)),
  );

  if (sentenceIndex < 0) {
    return null;
  }

  const start = Math.max(0, sentenceIndex - 1);
  const end = Math.min(sentences.length, sentenceIndex + 2);
  return sentences.slice(start, end).join(" ");
}

function extractMentionRank(text: string, searchTerms: string[]) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const listLines = lines.filter((line) => /^(\d+[\).\s]|[-*•]\s)/.test(line));

  if (listLines.length > 0) {
    const index = listLines.findIndex((line) =>
      searchTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(line)),
    );

    return index >= 0 ? index + 1 : null;
  }

  const sentences = splitIntoSentences(text);
  const sentenceIndex = sentences.findIndex((sentence) =>
    searchTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(sentence)),
  );

  return sentenceIndex >= 0 ? sentenceIndex + 1 : null;
}

function buildAuditedBrandNames(brand: BrandRecord, siteAnalysis: SiteAnalysisRecord | null) {
  return dedupe([
    brand.brand_name,
    ...(brand.brand_aliases ?? []),
    ...(siteAnalysis?.content_signals?.brandAliases ?? []),
    extractDomainName(brand.website_url),
  ])
    .map(normalizeDisplayName)
    .filter(Boolean);
}

function estimateExpectedCompetitorCount(responseText: string) {
  const numberedListCount = responseText.match(/^\s*\d+[\).\s]/gm)?.length ?? 0;
  const bulletListCount = responseText.match(/^\s*[-*•]\s+/gm)?.length ?? 0;
  const boldedBrandCount = responseText.match(/\*\*[^*]{2,80}\*\*/g)?.length ?? 0;
  return Math.max(numberedListCount, bulletListCount, boldedBrandCount, 0);
}

async function extractCompetitorMentions(
  brand: BrandRecord,
  siteAnalysis: SiteAnalysisRecord | null,
  promptText: string,
  responseText: string,
) {
  const auditedBrandNames = buildAuditedBrandNames(brand, siteAnalysis);
  const explicitCompetitors = dedupe(brand.competitor_urls.map(extractDomainName))
    .filter((name) => name.length >= 2)
    .map(normalizeDisplayName);
  const fallbackCompetitors = WELL_KNOWN_CONSUMER_HEALTH_BRANDS.filter(
    (name) =>
      !auditedBrandNames.some((auditedName) => auditedName.toLowerCase() === normalizeDisplayName(name).toLowerCase()),
  );
  const candidateCompetitors = dedupe([...explicitCompetitors, ...fallbackCompetitors]).filter(
    (name) =>
      !auditedBrandNames.some((auditedName) => auditedName.toLowerCase() === normalizeDisplayName(name).toLowerCase()),
  );
  const curatedMatches = dedupe(
    candidateCompetitors
      .filter((competitorName) => new RegExp(`\\b${escapeRegExp(competitorName)}\\b`, "i").test(responseText))
      .map(normalizeCompetitorName),
  );
  const expectedCompetitorCount = estimateExpectedCompetitorCount(responseText);

  if (curatedMatches.length >= Math.max(3, expectedCompetitorCount)) {
    return curatedMatches;
  }

  try {
    const llmMatches = await extractBrandMentionsWithHaiku({
      auditedBrandNames,
      promptText,
      responseText,
    });

    return dedupe(
      [...curatedMatches, ...llmMatches.map(normalizeCompetitorName)].filter(
        (name) =>
          name.length >= 2 &&
          !auditedBrandNames.some((auditedName) => auditedName.toLowerCase() === name.toLowerCase()),
      ),
    );
  } catch {
    return curatedMatches;
  }
}

function getBaseVisibilityScore(rank: number | null) {
  if (rank === null) {
    return 0;
  }

  if (rank === 1) {
    return 1;
  }

  if (rank === 2) {
    return 0.7;
  }

  return 0.5;
}

function classifySentimentHeuristically(responseText: string, brandMentioned: boolean) {
  if (REFUSAL_PATTERNS.some((pattern) => pattern.test(responseText))) {
    return "model_refused" as const;
  }

  if (!brandMentioned) {
    return "not_mentioned" as const;
  }

  if (/\b(best|excellent|great|strong|recommend|effective|trusted)\b/i.test(responseText)) {
    return "positive" as const;
  }

  if (/\b(avoid|poor|bad|weak|concern|warning|unsafe)\b/i.test(responseText)) {
    return "negative" as const;
  }

  return "neutral" as const;
}

export async function scoreBrandMention({
  brand,
  siteAnalysis,
  promptText,
  promptCategory,
  model,
  rawResponse,
  citationUrls,
  includeCompetitors,
}: {
  brand: BrandRecord;
  siteAnalysis: SiteAnalysisRecord | null;
  promptText: string;
  promptCategory: PromptCategory;
  model: PromptModel;
  rawResponse: string;
  citationUrls: string[];
  includeCompetitors: boolean;
}): Promise<PromptAnalysisResult> {
  const brandSearchTerms = buildBrandSearchTerms(brand, siteAnalysis);
  const firstMentionIndex = findFirstMentionIndex(rawResponse, brandSearchTerms);
  const brandMentioned = firstMentionIndex >= 0;
  const mentionRank = brandMentioned ? extractMentionRank(rawResponse, brandSearchTerms) ?? 1 : null;
  const mentionContext = brandMentioned ? extractMentionContext(rawResponse, brandSearchTerms) : null;

  let sentiment = classifySentimentHeuristically(rawResponse, brandMentioned);
  const competitorsMentioned = includeCompetitors
    ? await extractCompetitorMentions(brand, siteAnalysis, promptText, rawResponse)
    : [];

  if (brandMentioned && sentiment !== "model_refused") {
    try {
      sentiment = await classifySentimentWithHaiku({
        brandName: brand.brand_name,
        promptText,
        responseText: rawResponse,
        mentionContext,
      });
    } catch {
      sentiment = classifySentimentHeuristically(mentionContext ?? rawResponse, brandMentioned);
    }
  }

  return {
    promptText,
    promptCategory,
    model,
    rawResponse,
    citationUrls,
    brandMentioned,
    mentionRank,
    mentionContext,
    competitorsMentioned,
    sentiment,
    visibilityScore: getBaseVisibilityScore(mentionRank) * PROMPT_CATEGORY_WEIGHTS[promptCategory],
  };
}
