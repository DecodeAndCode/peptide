import "server-only";
import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/supabase/env";
import { ANALYSIS_SYSTEM_PROMPT, OPENAI_API_MODEL, type LlmTextResponse } from "@/lib/llm/shared";

let client: OpenAI | null = null;

function getClient() {
  client ??= new OpenAI({
    apiKey: getOpenAiApiKey(),
  });

  return client;
}

export async function queryOpenAi(
  prompt: string,
  options: { maxOutputTokens?: number } = {},
): Promise<LlmTextResponse> {
  const maxOutputTokens = options.maxOutputTokens ?? 800;
  try {
    const response = await getClient().responses.create({
      model: OPENAI_API_MODEL,
      temperature: 0.3,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "system",
          content: ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return {
      model: "gpt-4o",
      text: response.output_text.trim(),
      citationUrls: [],
    };
  } catch (error) {
    console.error("[openai]", {
      model: OPENAI_API_MODEL,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
