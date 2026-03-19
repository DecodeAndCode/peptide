"use client";

import { useMemo, useState } from "react";

interface PromptResultRowData {
  id: string;
  promptText: string;
  category: "explicit_recommendation" | "problem_solution" | "ingredient_education" | "product_interaction";
  model: "gpt-4o" | "claude-sonnet" | "perplexity-sonar-pro";
  mentioned: boolean;
  mentionRank: number | null;
  mentionContext: string | null;
  sentiment: string | null;
  competitorsMentioned: string[];
}

const categoryOptions = [
  { value: "all", label: "All categories" },
  { value: "explicit_recommendation", label: "Explicit Recommendation" },
  { value: "problem_solution", label: "Problem Solution" },
  { value: "ingredient_education", label: "Ingredient Education" },
  { value: "product_interaction", label: "Product Interaction" },
] as const;

const modelOptions = [
  { value: "all", label: "All models" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-sonnet", label: "Claude" },
  { value: "perplexity-sonar-pro", label: "Perplexity" },
] as const;

export function PromptResultsTable({ rows }: { rows: PromptResultRowData[] }) {
  const [view, setView] = useState<"all" | "hits" | "misses">("all");
  const [category, setCategory] = useState<string>("all");
  const [model, setModel] = useState<string>("all");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (view === "hits" && !row.mentioned) {
        return false;
      }

      if (view === "misses" && row.mentioned) {
        return false;
      }

      if (category !== "all" && row.category !== category) {
        return false;
      }

      if (model !== "all" && row.model !== model) {
        return false;
      }

      return true;
    });
  }, [category, model, rows, view]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {(["all", "hits", "misses"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`rounded-pill px-4 py-2 text-xs font-medium transition ${
              view === option
                ? "bg-sage text-white"
                : "border border-sage/15 bg-white text-dark hover:-translate-y-0.5"
            }`}
          >
            {option === "all" ? "All prompts" : option === "hits" ? "Hits" : "Misses"}
          </button>
        ))}

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-pill border border-sage/15 bg-white px-4 py-2 text-xs text-dark"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="rounded-pill border border-sage/15 bg-white px-4 py-2 text-xs text-dark"
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-3 text-sm text-mid">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[1.4px] text-sage">
              <th className="px-4">Prompt</th>
              <th className="px-4">Category</th>
              <th className="px-4">Model</th>
              <th className="px-4">Mentioned</th>
              <th className="px-4">Rank</th>
              <th className="px-4">Competitors</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="rounded-card bg-white shadow-card">
                <td className="rounded-l-card px-4 py-4 align-top">
                  <div className="font-medium text-dark">{row.promptText}</div>
                  {row.mentionContext ? (
                    <div className="mt-2 text-xs leading-6 text-mid">{row.mentionContext}</div>
                  ) : null}
                </td>
                <td className="px-4 py-4 align-top">{row.category.replaceAll("_", " ")}</td>
                <td className="px-4 py-4 align-top">{row.model}</td>
                <td className="px-4 py-4 align-top">{row.mentioned ? "Yes" : "No"}</td>
                <td className="px-4 py-4 align-top">{row.mentionRank ?? "-"}</td>
                <td className="rounded-r-card px-4 py-4 align-top">
                  {row.competitorsMentioned.join(", ") || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
