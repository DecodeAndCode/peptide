import "server-only";
import { scoreBrandMention } from "@/lib/analysis/brand-scorer";
import { queryAnthropic } from "@/lib/llm/anthropic";
import { queryOpenAi } from "@/lib/llm/openai";
import { queryPerplexity } from "@/lib/llm/perplexity";
import type {
  BrandRecord,
  PromptAnalysisResult,
  PromptCategory,
  PromptModel,
  SiteAnalysisRecord,
} from "@/types";

async function runModelQuery(model: PromptModel, promptText: string) {
  try {
    if (model === "gpt-4o") {
      return await queryOpenAi(promptText);
    }

    if (model === "claude-sonnet") {
      return await queryAnthropic(promptText);
    }

    return await queryPerplexity(promptText);
  } catch (error) {
    console.error("[llm-query]", {
      model,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function runPromptAcrossModels({
  brand,
  siteAnalysis,
  promptText,
  promptCategory,
  models,
  includeCompetitors,
}: {
  brand: BrandRecord;
  siteAnalysis: SiteAnalysisRecord | null;
  promptText: string;
  promptCategory: PromptCategory;
  models: PromptModel[];
  includeCompetitors: boolean;
}): Promise<PromptAnalysisResult[]> {
  const rawResponses = await Promise.all(models.map((model) => runModelQuery(model, promptText)));

  return Promise.all(
    rawResponses.map((response) =>
      scoreBrandMention({
        brand,
        siteAnalysis,
        promptText,
        promptCategory,
        model: response.model,
        rawResponse: response.text,
        citationUrls: response.citationUrls,
        includeCompetitors,
      }),
    ),
  );
}
