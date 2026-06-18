"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TONE_COLOR, type LevelTone } from "@/lib/levels";

interface Props {
  data: { tone: LevelTone; label: string; count: number }[];
}

/** Distribución de pacientes por severidad de su último resultado. */
export function SeverityDistribution({ data }: Props) {
  const total = data.reduce((a, b) => a + b.count, 0);
  if (total === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Todavía no hay resultados para distribuir.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
          />
          <Bar dataKey="count" name="Pacientes" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.tone} fill={TONE_COLOR[d.tone]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
