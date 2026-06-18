"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ChartSubscale, ChartToma } from "@/lib/charts";
import { levelTone, TONE_RANK } from "@/lib/levels";
import { cn } from "@/lib/utils";

interface Props {
  subscales: ChartSubscale[];
  first: ChartToma;
  last: ChartToma;
}

/** Compara primera vs última toma por subescala + resumen de cambio. */
export function BeforeAfterChart({ subscales, first, last }: Props) {
  const firstBy = new Map(first.scores.map((s) => [s.key, s]));
  const lastBy = new Map(last.scores.map((s) => [s.key, s]));

  const data = subscales.map((s) => ({
    label: s.label,
    primera: firstBy.get(s.key)?.raw ?? 0,
    ultima: lastBy.get(s.key)?.raw ?? 0,
  }));

  const changes = subscales.map((s) => {
    const f = firstBy.get(s.key);
    const l = lastBy.get(s.key);
    const fr = f ? (f.tone ?? levelTone(f.level)) : "mid";
    const lr = l ? (l.tone ?? levelTone(l.level)) : "mid";
    const dir =
      TONE_RANK[lr] < TONE_RANK[fr]
        ? "mejoró"
        : TONE_RANK[lr] > TONE_RANK[fr]
          ? "empeoró"
          : "estable";
    const delta = (l?.raw ?? 0) - (f?.raw ?? 0);
    return { key: s.key, label: s.label, dir, delta, from: f?.raw ?? 0, to: l?.raw ?? 0 };
  });

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-xs">
        Primera ({first.date}) vs última ({last.date})
      </div>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            <Legend />
            <Bar dataKey="primera" name="Primera" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ultima" name="Última" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {changes.map((c) => (
          <li key={c.key} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                c.dir === "mejoró" && "text-level-ok",
                c.dir === "empeoró" && "text-level-high",
              )}
            >
              {c.dir === "mejoró" ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : c.dir === "empeoró" ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {c.dir}
            </span>
            <span className="text-muted-foreground">
              {c.label}: {c.from} → {c.to}{" "}
              ({c.delta > 0 ? "+" : ""}
              {c.delta})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
