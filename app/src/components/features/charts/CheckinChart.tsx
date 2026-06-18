"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { describeValue } from "@/lib/checkins";

type QType = "SCALE_1_10" | "YES_NO" | "CHOICE";

interface ChartEntry {
  scheduledFor: Date | string;
  status: string;
  responseValue: number | null;
  respondedAt: Date | string | null;
}

interface CheckinChartProps {
  questionType: QType;
  options: string[];
  entries: ChartEntry[];
}

function shortDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/** Evolución de las respuestas de un seguimiento en el tiempo. */
export function CheckinChart({ questionType, options, entries }: CheckinChartProps) {
  const points = entries
    .filter((e) => e.status === "RESPONDED" && e.responseValue != null)
    .sort(
      (a, b) =>
        new Date(a.respondedAt ?? a.scheduledFor).getTime() -
        new Date(b.respondedAt ?? b.scheduledFor).getTime(),
    )
    .map((e) => ({ date: shortDate(e.respondedAt ?? e.scheduledFor), value: e.responseValue as number }));

  // Una línea necesita al menos 2 puntos.
  if (points.length < 2) return null;

  // Eje Y según el tipo de pregunta.
  let domain: [number, number];
  let ticks: number[];
  if (questionType === "YES_NO") {
    domain = [0, 1];
    ticks = [0, 1];
  } else if (questionType === "CHOICE") {
    const n = Math.max(options.length, 2);
    domain = [1, n];
    ticks = Array.from({ length: n }, (_, i) => i + 1);
  } else {
    domain = [1, 10];
    ticks = [1, 5, 10];
  }

  const yTick = (v: number) => {
    if (questionType === "YES_NO") return v === 1 ? "Sí" : "No";
    if (questionType === "CHOICE") {
      const label = options[v - 1] ?? "";
      return label.length > 10 ? `${label.slice(0, 9)}…` : label;
    }
    return String(v);
  };

  // Sí/No: puntos sueltos (sin línea, que sugeriría transición gradual) + resumen.
  const isYesNo = questionType === "YES_NO";
  const yesCount = points.filter((p) => p.value === 1).length;
  const summary = isYesNo
    ? `Sí: ${yesCount} de ${points.length} (${Math.round((yesCount / points.length) * 100)}%)`
    : null;

  return (
    <div>
      {summary && <p className="text-muted-foreground mb-1 text-xs font-medium">{summary}</p>}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis
              domain={domain}
              ticks={ticks}
              tickFormatter={yTick}
              width={questionType === "SCALE_1_10" ? 28 : 72}
              stroke="var(--muted-foreground)"
              fontSize={11}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
              formatter={(value) => [
                describeValue(questionType, Number(value), options),
                "Respuesta",
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1)"
              // Sí/No: sin línea (strokeWidth 0), solo los puntos.
              strokeWidth={isYesNo ? 0 : 2}
              dot={{ r: isYesNo ? 4 : 3, fill: "var(--chart-1)", stroke: "var(--chart-1)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
