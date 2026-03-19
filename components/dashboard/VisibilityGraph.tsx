"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  return (
    <div className="space-y-4">
      {showPlaceholderLabel ? (
        <div className="rounded-card border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-mid">
          Your data will appear after your first cycle. The chart below is a placeholder preview of
          how year-to-date model visibility trends will render.
        </div>
      ) : null}

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
            />
            <Line type="monotone" dataKey="average" stroke="#7a9e87" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="gpt-4o" stroke="#1e2620" strokeWidth={2} dot={false} connectNulls />
            <Line
              type="monotone"
              dataKey="claude-sonnet"
              stroke="#a8c5b0"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="perplexity-sonar-pro"
              stroke="#c8a96e"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
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
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sage-light" />
          Claude
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Perplexity
        </span>
      </div>
    </div>
  );
}
