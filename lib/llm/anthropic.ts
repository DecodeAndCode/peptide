import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/supabase/env";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANTHROPIC_API_MODEL,
  ANTHROPIC_SENTIMENT_MODEL,
  type LlmTextResponse,
} from "@/lib/llm/shared";
import type { PromptSentiment } from "@/types";

let client: Anthropic | null = null;

function getClient() {
  client ??= new Anthropic({
    apiKey: getAnthropicApiKey(),
  });

  return client;
}

const sentimentSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "not_mentioned", "model_refused"]),
});

const extractedBrandsSchema = z.object({
  names: z.array(z.string().trim().min(2).max(120)).max(20),
});

function getFirstTextBlock(content: Anthropic.Messages.Message["content"]) {
  const textBlock = content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}

export async function queryAnthropic(prompt: string): Promise<LlmTextResponse> {
  const response = await getClient().messages.create({
    model: ANTHROPIC_API_MODEL,
    system: ANALYSIS_SYSTEM_PROMPT,
    temperature: 0.3,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    model: "claude-sonnet",
    text: getFirstTextBlock(response.content),
    citationUrls: [],
  };
}

export async function classifySentimentWithHaiku({
  brandName,
  promptText,
  responseText,
  mentionContext,
}: {
  brandName: string;
  promptText: string;
  responseText: string;
  mentionContext: string | null;
}): Promise<PromptSentiment> {
  const truncatedResponse = responseText.slice(0, 2400);
  const response = await getClient().messages.create({
    model: ANTHROPIC_SENTIMENT_MODEL,
    system:
      "Classify whether the brand mention is positive, neutral, negative, or not_mentioned. Return only compact JSON.",
    temperature: 0,
    max_tokens: 60,
    messages: [
      {
        role: "user",
        content: [
          `Brand: ${brandName}`,
          `Prompt: ${promptText}`,
          `Mention context: ${mentionContext ?? "None"}`,
          `Response excerpt: ${truncatedResponse}`,
          'Return JSON only in the form {"sentiment":"positive|neutral|negative|not_mentioned"}.',
        ].join("\n"),
      },
    ],
  });

  const parsed = sentimentSchema.safeParse(JSON.parse(getFirstTextBlock(response.content)));
  return parsed.success ? parsed.data.sentiment : "neutral";
}

export async function extractBrandMentionsWithHaiku({
  auditedBrandNames,
  promptText,
  responseText,
}: {
  auditedBrandNames: string[];
  promptText: string;
  responseText: string;
}) {
  const response = await getClient().messages.create({
    model: ANTHROPIC_SENTIMENT_MODEL,
    system:
      "Extract supplement, wellness, skincare, and consumer health brand or product names from the response. Return compact JSON only.",
    temperature: 0,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          `Audited brand names to exclude: ${auditedBrandNames.join(", ") || "None"}`,
          `Prompt: ${promptText}`,
          `Response excerpt: ${responseText.slice(0, 3200)}`,
          'Return JSON only in the form {"names":["Brand One","Brand Two"]}. Include every distinct competitor brand or branded product mentioned, excluding the audited brand names.',
        ].join("\n"),
      },
    ],
  });

  const parsed = extractedBrandsSchema.safeParse(JSON.parse(getFirstTextBlock(response.content)));
  return parsed.success ? parsed.data.names : [];
}
