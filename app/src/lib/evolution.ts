import type { ScoreResult } from "@/lib/scoring/types";

export interface EvolutionPoint {
  date: string;
  [subscaleKey: string]: string | number;
}

export interface EvolutionSeries {
  key: string;
  label: string;
}

interface CompletedItem {
  completedAt: Date | null;
  createdAt: Date;
  scoresJson: unknown;
}

/**
 * Construye la serie temporal de un test a partir de sus resultados
 * completados (ordenados por fecha). Devuelve los puntos y las subescalas.
 */
export function buildEvolution(items: CompletedItem[]): {
  data: EvolutionPoint[];
  series: EvolutionSeries[];
} {
  const sorted = [...items].sort((a, b) => {
    const da = (a.completedAt ?? a.createdAt).getTime();
    const db = (b.completedAt ?? b.createdAt).getTime();
    return da - db;
  });

  const series: EvolutionSeries[] = [];
  const data: EvolutionPoint[] = sorted.map((item) => {
    const scores = item.scoresJson as unknown as ScoreResult;
    const point: EvolutionPoint = {
      date: (item.completedAt ?? item.createdAt).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
    for (const s of scores.scores) {
      point[s.key] = s.raw;
      if (!series.some((x) => x.key === s.key)) {
        series.push({ key: s.key, label: s.label });
      }
    }
    return point;
  });

  return { data, series };
}
