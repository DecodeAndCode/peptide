import "server-only";
import { getPerplexityApiKey } from "@/lib/supabase/env";
import { ANALYSIS_SYSTEM_PROMPT, PERPLEXITY_API_MODEL, type LlmTextResponse } from "@/lib/llm/shared";

interface PerplexityMessage {
  content?: string;
}

interface PerplexityChoice {
  message?: PerplexityMessage;
}

interface PerplexityCitationObject {
  url?: string;
}

interface PerplexityResponse {
  choices?: PerplexityChoice[];
  citations?: Array<string | PerplexityCitationObject>;
}

function normalizeCitations(citations: PerplexityResponse["citations"]) {
  if (!Array.isArray(citations)) {
    return [];
  }

  return citations
    .map((citation) => {
      if (typeof citation === "string") {
        return citation;
      }

      return citation.url ?? null;
    })
    .filter((citation): citation is string => Boolean(citation));
}

export async function queryPerplexity(prompt: string): Promise<LlmTextResponse> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPerplexityApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PERPLEXITY_API_MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Perplexity query failed.");
    }

    const payload = (await response.json()) as PerplexityResponse;

    return {
      model: "perplexity-sonar-pro",
      text: payload.choices?.[0]?.message?.content?.trim() ?? "",
      citationUrls: normalizeCitations(payload.citations),
    };
  } catch (error) {
    console.error("[perplexity]", {
      model: PERPLEXITY_API_MODEL,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
