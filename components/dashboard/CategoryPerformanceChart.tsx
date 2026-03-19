"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CategoryPerformanceRow {
  category: string;
  label: string;
  "gpt-4o": number;
  "claude-sonnet": number;
  "perplexity-sonar-pro": number;
}

export function CategoryPerformanceChart({ data }: { data: CategoryPerformanceRow[] }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 40 }}>
          <CartesianGrid stroke="rgba(122, 158, 135, 0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            angle={-18}
            textAnchor="end"
            interval={0}
            height={60}
            tick={{ fill: "#4a5c50", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#4a5c50", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(122, 158, 135, 0.14)",
              backgroundColor: "#ffffff",
            }}
          />
          <Legend />
          <Bar dataKey="gpt-4o" fill="#1e2620" radius={[8, 8, 0, 0]} />
          <Bar dataKey="claude-sonnet" fill="#a8c5b0" radius={[8, 8, 0, 0]} />
          <Bar dataKey="perplexity-sonar-pro" fill="#c8a96e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
