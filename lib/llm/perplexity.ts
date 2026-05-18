import "server-only";
import { getPerplexityApiKey, getPerplexityApiModel } from "@/lib/supabase/env";
import { ANALYSIS_SYSTEM_PROMPT, type LlmTextResponse } from "@/lib/llm/shared";

const RESPONSE_BODY_LOG_MAX_CHARS = 500;

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

export type QueryPerplexityOptions = {
  maxTokens?: number;
};

export async function queryPerplexity(prompt: string, options?: QueryPerplexityOptions): Promise<LlmTextResponse> {
  const apiModel = getPerplexityApiModel();
  const maxTokens = options?.maxTokens ?? 800;
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPerplexityApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: apiModel,
        temperature: 0.3,
        max_tokens: maxTokens,
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
      const rawBody = await response.text();
      const bodySnippet =
        rawBody.length > RESPONSE_BODY_LOG_MAX_CHARS
          ? `${rawBody.slice(0, RESPONSE_BODY_LOG_MAX_CHARS)}…`
          : rawBody;
      console.error("[perplexity]", {
        message: "HTTP error from Perplexity API",
        status: response.status,
        bodySnippet,
        model: apiModel,
      });
      throw new Error(`Perplexity query failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as PerplexityResponse;

    return {
      model: "perplexity-sonar-pro",
      text: payload.choices?.[0]?.message?.content?.trim() ?? "",
      citationUrls: normalizeCitations(payload.citations),
    };
  } catch (error) {
    console.error("[perplexity]", {
      model: apiModel,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
