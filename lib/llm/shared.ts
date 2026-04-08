import type { PromptModel } from "@/types";

export interface LlmTextResponse {
  model: PromptModel;
  text: string;
  citationUrls: string[];
}

export const ANALYSIS_SYSTEM_PROMPT =
  "You are a helpful health and wellness assistant. Answer the user's question naturally.";

export const OPENAI_API_MODEL = "gpt-4o";
export const ANTHROPIC_API_MODEL = "claude-sonnet-4-5";
export const ANTHROPIC_SENTIMENT_MODEL = "claude-haiku-4-5-20251001";
export const PERPLEXITY_API_MODEL = "sonar-pro";
