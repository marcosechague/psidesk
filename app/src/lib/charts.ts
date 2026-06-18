import type { ResponseType } from "@prisma/client";
import type {
  Cutoff,
  ScoreResult,
  ScoringConfig,
  SubscaleScore,
} from "@/lib/scoring/types";
import { maxPerItem } from "@/lib/scoring/types";

export interface ChartToma {
  /** fecha corta para el eje, ej "12/03" */
  date: string;
  scores: SubscaleScore[];
}

export interface ChartSubscale {
  key: string;
  label: string;
  max: number;
  cutoffs: Cutoff[];
}

export interface TestChartData {
  testId: string;
  testName: string;
  subscales: ChartSubscale[];
  tomas: ChartToma[];
}

interface AssignmentLike {
  testId: string;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  test: { name: string; responseType: ResponseType; scoringJson: unknown };
  result: { scoresJson: unknown } | null;
}

/**
 * A partir de las asignaciones de un paciente, arma los datos de gráficos
 * por test: las "tomas" ordenadas en el tiempo y la metadata de subescalas
 * (máximo y cortes) para dibujar bandas/heatmap. Función pura (server-safe).
 */
export function buildTestCharts(assignments: AssignmentLike[]): TestChartData[] {
  const completed = assignments
    // solo tomas puntuadas (las cargadas a mano no tienen subescalas para graficar)
    .filter((a) => a.status === "COMPLETED" && a.result?.scoresJson)
    .sort(
      (a, b) =>
        (a.completedAt ?? a.createdAt).getTime() -
        (b.completedAt ?? b.createdAt).getTime(),
    );

  const groups = new Map<string, TestChartData>();

  for (const a of completed) {
    const result = a.result!.scoresJson as unknown as ScoreResult;
    let g = groups.get(a.testId);
    if (!g) {
      const cfg = a.test.scoringJson as unknown as ScoringConfig;
      const perItem = maxPerItem(a.test.responseType);
      g = {
        testId: a.testId,
        testName: a.test.name,
        subscales: cfg.subscales.map((s) => ({
          key: s.key,
          label: s.label,
          max: s.items.length * perItem * (s.multiplier ?? 1),
          cutoffs: s.cutoffs,
        })),
        tomas: [],
      };
      groups.set(a.testId, g);
    }
    g.tomas.push({
      date: (a.completedAt ?? a.createdAt).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
      scores: result.scores,
    });
  }

  return [...groups.values()];
}
