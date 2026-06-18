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

interface Props {
  data: { week: string; citas: number; tests: number }[];
}

/** Carga de las últimas semanas: citas y tests asignados. */
export function WeeklyLoadChart({ data }: Props) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
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
          <Legend />
          <Bar dataKey="citas" name="Sesiones" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="tests" name="Tests" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
