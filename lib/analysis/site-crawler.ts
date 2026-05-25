import * as cheerio from "cheerio";
import { canonicalizeIngredientList } from "@/lib/analysis/ingredient-normalization";
import { INDUSTRY_GAP_KEYWORDS, getIndustryLabel } from "@/lib/suppgo";
import type { SiteAnalysisContentSignals } from "@/types";

interface CrawledPage {
  url: string;
  html: string;
}

export interface SiteAnalysisResult {
  pagesAnalyzed: number;
  hasLlmsTxt: boolean;
  llmsTxtContent: string | null;
  hasSchemaMarkup: boolean;
  javascriptRenderingIssues: string[];
  contentSignals: SiteAnalysisContentSignals;
  missingContentGaps: string[];
  recommendations: string[];
}

const PAGE_HINTS = ["product", "shop", "faq", "blog", "about", "science", "learn", "ingredient"];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toAbsoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractCleanText($: cheerio.CheerioAPI) {
  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(items: string[], limit = 12) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function normalizeDisplayName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) =>
      /^[A-Z0-9&+.-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(" ");
}

function extractDomainName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function extractTopicKeywords(text: string) {
  const matches = text.match(/\b[a-z][a-z0-9+\-]{3,}\b/gi) ?? [];
  const counts = new Map<string, number>();

  matches.forEach((match) => {
    const key = match.toLowerCase();

    if (["with", "that", "this", "from", "your", "have", "about", "brand"].includes(key)) {
      return;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([keyword]) => keyword);
}

function extractSignalsFromPage(page: CrawledPage) {
  const $ = cheerio.load(page.html);
  const text = extractCleanText($);
  const headings = $("h1, h2, h3")
    .map((_, element) => $(element).text().trim())
    .get();

  const faqTopics = headings.filter((heading) => heading.includes("?"));
  const productNames = [
    ...headings.filter((heading) =>
      /(serum|capsule|powder|blend|formula|supplement|cream|gel|drops)/i.test(heading),
    ),
    ...$("script[type='application/ld+json']")
      .map((_, element) => $(element).html() ?? "")
      .get()
      .flatMap((schemaText) => {
        const names = schemaText.match(/"name"\s*:\s*"([^"]+)"/gi) ?? [];
        return names.map((name) => name.replace(/"name"\s*:\s*"/i, "").replace(/"$/, ""));
      }),
  ];

  const ingredients = text.match(
    /\b(?:magnesium|creatine|ashwagandha|rhodiola|lion's mane|collagen|ghk-cu|berberine|nmn|nad\+|protein|greens)\b/gi,
  );
  const healthClaims =
    text.match(
      /\b(?:supports?|helps?|improves?|boosts?|promotes?|designed for)\b[^.?!]{0,120}[.?!]/gi,
    ) ?? [];

  return {
    urls: [page.url],
    hasSchemaMarkup: $("script[type='application/ld+json']").length > 0,
    productNames: dedupe(productNames, 8),
    ingredients: canonicalizeIngredientList(ingredients ?? [], 10),
    healthClaims: dedupe(healthClaims, 8),
    faqTopics: dedupe(faqTopics, 8),
    topicKeywords: extractTopicKeywords(text),
    isJavascriptHeavy:
      /__next|application\/json|hydration|webpack|bundle/i.test(page.html) &&
      text.length < 900,
  };
}

function extractBrandAliases({
  brandName,
  websiteUrl,
  pages,
  llmsTxtContent,
}: {
  brandName: string;
  websiteUrl: string;
  pages: CrawledPage[];
  llmsTxtContent: string | null;
}) {
  const escapedBrandName = escapeRegExp(brandName);
  const domainCandidate = normalizeDisplayName(extractDomainName(websiteUrl));
  const normalizedPrimaryBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const combinedText = [llmsTxtContent ?? "", ...pages.map((page) => cheerio.load(page.html)("body").text())].join(
    "\n",
  );
  const aliasMatches = [
    ...combinedText.matchAll(
      new RegExp(`${escapedBrandName}\\s*(?:,|\\()\\s*(?:formerly known as|formerly|by)\\s+([^)\\n,.]{2,60})`, "gi"),
    ),
    ...combinedText.matchAll(
      new RegExp(`([A-Z][A-Za-z0-9&+.'’\\- ]{1,60})\\s+(?:rebranded as|is now|now called)\\s+${escapedBrandName}`, "gi"),
    ),
    ...combinedText.matchAll(
      new RegExp(`${escapedBrandName}\\s*[-:]\\s*formerly\\s+([A-Z][A-Za-z0-9&+.'’\\- ]{1,60})`, "gi"),
    ),
  ]
    .map((match) => normalizeDisplayName(match[1] ?? ""))
    .filter(Boolean);

  return dedupe(
    [domainCandidate, ...aliasMatches].filter(
      (candidate) =>
        candidate.toLowerCase() !== brandName.toLowerCase() &&
        candidate.length >= 2 &&
        !candidate.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalizedPrimaryBrand),
    ),
    8,
  );
}

function detectMissingContentGaps(industryTags: string[], topicKeywords: string[]) {
  return industryTags
    .filter((tag) => {
      const keywords = INDUSTRY_GAP_KEYWORDS[tag] ?? [];
      return !keywords.some((keyword) =>
        topicKeywords.some((topicKeyword) => topicKeyword.includes(keyword.toLowerCase())),
      );
    })
    .map((tag) => getIndustryLabel(tag));
}

function buildRecommendations({
  hasLlmsTxt,
  hasSchemaMarkup,
  javascriptIssues,
  missingContentGaps,
  contentSignals,
}: {
  hasLlmsTxt: boolean;
  hasSchemaMarkup: boolean;
  javascriptIssues: string[];
  missingContentGaps: string[];
  contentSignals: SiteAnalysisContentSignals;
}) {
  const recommendations: string[] = [];

  if (!hasLlmsTxt) {
    recommendations.push("Add a `/llms.txt` file that summarizes products, ingredients, and trusted claims.");
  }

  if (!hasSchemaMarkup) {
    recommendations.push("Add product and FAQ schema markup to make brand information easier for models to extract.");
  }

  if (javascriptIssues.length > 0) {
    recommendations.push("Ensure important product copy and FAQ content render as static HTML, not only after hydration.");
  }

  if (missingContentGaps.length > 0) {
    recommendations.push(
      `Expand content coverage for ${missingContentGaps.slice(0, 3).join(", ")} to improve prompt-library relevance.`,
    );
  }

  if (contentSignals.faqTopics.length < 3) {
    recommendations.push("Publish more FAQ-style pages that answer direct consumer health questions in plain language.");
  }

  return recommendations.slice(0, 5);
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": BROWSER_USER_AGENT,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (status ${response.status})`);
  }

  return response.text();
}

async function collectPages(baseUrl: string) {
  let homepageHtml: string;
  try {
    homepageHtml = await fetchText(baseUrl);
  } catch (err) {
    console.warn(`[site-crawler] homepage fetch failed for ${baseUrl}:`, err);
    return [];
  }
  const homepage: CrawledPage = { url: baseUrl, html: homepageHtml };
  const $ = cheerio.load(homepageHtml);
  const rootHost = new URL(baseUrl).host;

  const candidateUrls = dedupe(
    $("a[href]")
      .map((_, element) => $(element).attr("href") ?? "")
      .get()
      .filter((href) => !href.startsWith("#") && !href.startsWith("mailto:"))
      .map((href) => toAbsoluteUrl(baseUrl, href))
      .filter((href): href is string => Boolean(href))
      .filter((href) => new URL(href).host === rootHost)
      .filter((href) => PAGE_HINTS.some((hint) => href.toLowerCase().includes(hint))),
    10,
  );

  const internalPages = await Promise.all(
    candidateUrls.map(async (url) => {
      try {
        const html = await fetchText(url);
        return { url, html } satisfies CrawledPage;
      } catch {
        return null;
      }
    }),
  );

  return [homepage, ...internalPages.filter((page): page is CrawledPage => page !== null)];
}

export async function analyzeSite(
  url: string,
  industryTags: string[],
  brandName: string,
): Promise<SiteAnalysisResult> {
  const normalizedUrl = normalizeUrl(url);
  const pages = await collectPages(normalizedUrl);

  let llmsTxtContent: string | null = null;

  try {
    llmsTxtContent = await fetchText(`${normalizedUrl}/llms.txt`);
  } catch {
    llmsTxtContent = null;
  }

  const pageSignals = pages.map(extractSignalsFromPage);
  const contentSignals: SiteAnalysisContentSignals = {
    brandAliases: extractBrandAliases({
      brandName,
      websiteUrl: normalizedUrl,
      pages,
      llmsTxtContent,
    }),
    productNames: dedupe(pageSignals.flatMap((signal) => signal.productNames)),
    ingredients: canonicalizeIngredientList(pageSignals.flatMap((signal) => signal.ingredients)),
    healthClaims: dedupe(pageSignals.flatMap((signal) => signal.healthClaims)),
    faqTopics: dedupe(pageSignals.flatMap((signal) => signal.faqTopics)),
    topicKeywords: dedupe(pageSignals.flatMap((signal) => signal.topicKeywords), 12),
  };

  const javascriptRenderingIssues = pageSignals.some((signal) => signal.isJavascriptHeavy)
    ? [
        "Key pages appear to depend heavily on client-side rendering, which can weaken LLM crawlability.",
      ]
    : [];

  const missingContentGaps = detectMissingContentGaps(industryTags, contentSignals.topicKeywords);
  const recommendations = buildRecommendations({
    hasLlmsTxt: Boolean(llmsTxtContent),
    hasSchemaMarkup: pageSignals.some((signal) => signal.hasSchemaMarkup),
    javascriptIssues: javascriptRenderingIssues,
    missingContentGaps,
    contentSignals,
  });

  if (pages.length === 0) {
    recommendations.unshift(
      "We couldn't crawl your site — bot protection (e.g. Cloudflare, PerimeterX) is blocking automated requests. Allowlist SuppGO's crawler or publish an `/llms.txt` file so models can still discover your brand.",
    );
  }

  return {
    pagesAnalyzed: pages.length,
    hasLlmsTxt: Boolean(llmsTxtContent),
    llmsTxtContent,
    hasSchemaMarkup: pageSignals.some((signal) => signal.hasSchemaMarkup),
    javascriptRenderingIssues,
    contentSignals,
    missingContentGaps,
    recommendations,
  };
}
