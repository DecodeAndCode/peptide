import "server-only";
import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/supabase/env";
import { ANALYSIS_SYSTEM_PROMPT, OPENAI_API_MODEL, type LlmTextResponse } from "@/lib/llm/shared";

const client = new OpenAI({
  apiKey: getOpenAiApiKey(),
});

export async function queryOpenAi(prompt: string): Promise<LlmTextResponse> {
  const response = await client.responses.create({
    model: OPENAI_API_MODEL,
    temperature: 0.3,
    max_output_tokens: 800,
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
}
