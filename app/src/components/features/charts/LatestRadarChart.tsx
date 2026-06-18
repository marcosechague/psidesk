"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ChartSubscale, ChartToma } from "@/lib/charts";

interface Props {
  subscales: ChartSubscale[];
  latest: ChartToma;
}

/** Radar del último resultado (útil con 3+ subescalas, ej. DASS). */
export function LatestRadarChart({ subscales, latest }: Props) {
  if (subscales.length < 3) return null;

  const by = new Map(latest.scores.map((s) => [s.key, s]));
  const maxMax = Math.max(...subscales.map((s) => s.max), 1);
  const data = subscales.map((s) => ({
    label: s.label,
    value: by.get(s.key)?.raw ?? 0,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, maxMax]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <Radar
            dataKey="value"
            name={`Última toma (${latest.date})`}
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
