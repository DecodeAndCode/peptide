"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRoundedValue } from "@/lib/formatting";

interface VisibilityGraphPoint {
  cycleId: string;
  cycleLabel: string;
  cycleDate: string;
  average: number;
  "gpt-4o": number | null;
  "claude-sonnet": number | null;
  "perplexity-sonar-pro": number | null;
}

interface VisibilityGraphProps {
  data: VisibilityGraphPoint[];
  showPlaceholderLabel: boolean;
}

export function VisibilityGraph({ data, showPlaceholderLabel }: VisibilityGraphProps) {
  const modelSeries = [
    { key: "gpt-4o" as const, label: "GPT-4o", color: "#1e2620" },
    { key: "claude-sonnet" as const, label: "Claude", color: "#a8c5b0" },
    { key: "perplexity-sonar-pro" as const, label: "Perplexity", color: "#c8a96e" },
  ];
  const activeSeries = modelSeries.filter((series) =>
    data.some((point) => point[series.key] !== null && point[series.key] !== undefined),
  );

  if (showPlaceholderLabel) {
    return (
      <div className="rounded-card border border-sage/12 bg-white px-6 py-10 text-center">
        <div className="text-sm font-medium text-dark">Complete 3 or more cycles to see your trend.</div>
        <p className="mt-3 text-sm leading-7 text-mid">
          SuppGo will chart cross-model visibility over time once enough completed cycles exist to
          show a meaningful trend line.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="cycleDate"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#4a5c50", fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#4a5c50", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 18,
                border: "1px solid rgba(122, 158, 135, 0.14)",
                backgroundColor: "#ffffff",
                color: "#1e2620",
              }}
              formatter={(value) =>
                typeof value === "number" ? [formatRoundedValue(value), "Visibility score"] : [value, ""]
              }
            />
            <Line type="monotone" dataKey="average" stroke="#7a9e87" strokeWidth={3} dot={{ r: 3 }} />
            {activeSeries.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-mid">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sage" />
          Combined average
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-dark" />
          GPT-4o
        </span>
        {activeSeries
          .filter((series) => series.key !== "gpt-4o")
          .map((series) => (
            <span key={series.key} className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </span>
          ))}
      </div>
    </div>
  );
}
