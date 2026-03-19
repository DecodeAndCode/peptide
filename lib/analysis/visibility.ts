import { PROMPT_CATEGORY_WEIGHTS } from "@/lib/suppgo";
import type { PromptCategory } from "@/types";

export function getBaseVisibilityScore(rank: number | null) {
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

export function getWeightedVisibilityScore(category: PromptCategory, rank: number | null) {
  return getBaseVisibilityScore(rank) * PROMPT_CATEGORY_WEIGHTS[category];
}

export function toVisibilityIndex(totalScore: number, sampleCount: number) {
  if (sampleCount <= 0) {
    return 0;
  }

  return Math.round((totalScore / sampleCount) * 10000) / 100;
}
