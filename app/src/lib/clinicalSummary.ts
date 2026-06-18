import { levelTone, worstTone, TONE_RANK, type LevelTone } from "@/lib/levels";
import type { ScoreResult, SubscaleScore } from "@/lib/scoring/types";

/** Tendencia de una toma respecto de la anterior del mismo test. */
export type ResultTrend = "up" | "down" | "flat" | null;

/** Snapshot clínico de un paciente para el panel de contexto del workspace. */
export interface PatientSnapshot {
  /** Último resultado completado, con el peor nivel entre sus subescalas. */
  lastResult: {
    testName: string;
    levelLabel: string;
    tone: LevelTone;
    when: Date;
    /** Comparación con la toma anterior del mismo test ("up" = empeoró). */
    trend: ResultTrend;
  } | null;
  /** true si la última toma de algún test empeoró respecto de la anterior. */
  worsening: boolean;
}

interface AssignmentLike {
  status: string;
  testId: string;
  createdAt: Date;
  completedAt: Date | null;
  test: { name: string };
  result: { scoresJson: unknown } | null;
}

function scoresOf(a: AssignmentLike): SubscaleScore[] {
  const sj = a.result?.scoresJson;
  if (!sj) return [];
  return (sj as unknown as ScoreResult).scores ?? [];
}

/** Subescala con el peor tono (para mostrar la etiqueta de nivel más relevante). */
function worstSubscale(scores: SubscaleScore[]): SubscaleScore | null {
  let worst: SubscaleScore | null = null;
  for (const s of scores) {
    const t = s.tone ?? levelTone(s.level);
    if (!worst || TONE_RANK[t] > TONE_RANK[worst.tone ?? levelTone(worst.level)]) {
      worst = s;
    }
  }
  return worst;
}

/** Resultado mostrable de UNA asignación completada (o null si no aplica). */
export function resultOf(a: AssignmentLike): {
  testName: string;
  levelLabel: string;
  tone: LevelTone;
  when: Date;
} | null {
  if (!(a.status === "COMPLETED" && a.result && a.completedAt)) return null;
  // Resultado cargado a mano (sin puntaje del sistema): no es un "resultado
  // puntuado" — lo manejan las vistas de hallazgos, no esta función.
  if (!a.result.scoresJson) return null;
  const scores = scoresOf(a);
  const ws = worstSubscale(scores);
  return {
    testName: a.test.name,
    levelLabel: ws?.levelLabel ?? "—",
    tone: worstTone(scores),
    when: a.completedAt,
  };
}

export function patientSnapshot(assignments: AssignmentLike[]): PatientSnapshot {
  const completed = assignments
    // solo resultados puntuados por el sistema (los cargados a mano no tienen tono)
    .filter((a) => a.status === "COMPLETED" && a.result?.scoresJson && a.completedAt)
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());

  // Tomas agrupadas por test (orden ascendente por fecha de completado).
  const byTest = new Map<string, AssignmentLike[]>();
  for (const a of completed) {
    const arr = byTest.get(a.testId) ?? [];
    arr.push(a);
    byTest.set(a.testId, arr);
  }

  // Empeoramiento: por test, comparar las dos últimas tomas.
  let worsening = false;
  for (const arr of byTest.values()) {
    if (arr.length >= 2) {
      const prev = worstTone(scoresOf(arr[arr.length - 2]));
      const last = worstTone(scoresOf(arr[arr.length - 1]));
      if (TONE_RANK[last] > TONE_RANK[prev]) worsening = true;
    }
  }

  // Último resultado (por fecha de completado), con su tendencia vs la toma previa.
  const latest = completed[completed.length - 1] ?? null;
  const base = latest ? resultOf(latest) : null;
  let lastResult: PatientSnapshot["lastResult"] = null;
  if (base && latest) {
    const arr = byTest.get(latest.testId) ?? [];
    let trend: ResultTrend = null;
    if (arr.length >= 2) {
      const prev = worstTone(scoresOf(arr[arr.length - 2]));
      const last = worstTone(scoresOf(arr[arr.length - 1]));
      trend =
        TONE_RANK[last] > TONE_RANK[prev]
          ? "up"
          : TONE_RANK[last] < TONE_RANK[prev]
            ? "down"
            : "flat";
    }
    lastResult = { ...base, trend };
  }

  return { lastResult, worsening };
}
