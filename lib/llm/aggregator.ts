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

function buildProviderFailureResult({
  promptText,
  promptCategory,
  model,
  error,
}: {
  promptText: string;
  promptCategory: PromptCategory;
  model: PromptModel;
  error: unknown;
}): PromptAnalysisResult {
  const message = error instanceof Error ? error.message : "The model provider did not return a response.";

  return {
    promptText,
    promptCategory,
    model,
    rawResponse: `Provider unavailable: ${message}`,
    citationUrls: [],
    brandMentioned: false,
    mentionRank: null,
    mentionContext: null,
    competitorsMentioned: [],
    sentiment: "model_refused",
    visibilityScore: 0,
  };
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
  return Promise.all(
    models.map(async (model) => {
      try {
        const response = await runModelQuery(model, promptText);

        return scoreBrandMention({
          brand,
          siteAnalysis,
          promptText,
          promptCategory,
          model: response.model,
          rawResponse: response.text,
          citationUrls: response.citationUrls,
          includeCompetitors,
        });
      } catch (error) {
        return buildProviderFailureResult({
          promptText,
          promptCategory,
          model,
          error,
        });
      }
    }),
  );
}
