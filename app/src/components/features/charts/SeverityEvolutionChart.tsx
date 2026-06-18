"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { ChartSubscale, ChartToma } from "@/lib/charts";
import { levelTone, TONE_COLOR } from "@/lib/levels";

const LINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Props {
  subscales: ChartSubscale[];
  tomas: ChartToma[];
}

/** Evolución en el tiempo. Con 1 subescala dibuja bandas de severidad de fondo. */
export function SeverityEvolutionChart({ subscales, tomas }: Props) {
  if (tomas.length < 2) return null;

  const data = tomas.map((t) => {
    const row: Record<string, string | number> = { date: t.date };
    for (const s of t.scores) row[s.key] = s.raw;
    return row;
  });

  const maxY = Math.max(...subscales.map((s) => s.max), 1);
  const single = subscales.length === 1 ? subscales[0] : null;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          {single?.cutoffs.map((c, i) => {
            const tone = c.tone ?? levelTone(c.level);
            return (
              <ReferenceArea
                key={i}
                y1={c.min}
                y2={Math.min(c.max, maxY)}
                fill={TONE_COLOR[tone]}
                fillOpacity={0.1}
                stroke="none"
              />
            );
          })}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis
            domain={[0, maxY]}
            stroke="var(--muted-foreground)"
            fontSize={12}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
          />
          <Legend />
          {subscales.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
