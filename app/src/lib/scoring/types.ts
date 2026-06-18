import type { ResponseType } from "@prisma/client";

/** Tono visual de severidad/alerta (independiente del nombre del nivel). */
export type LevelTone = "ok" | "low" | "mid" | "high" | "max";

/** Rango de corte para asignar un nivel a un puntaje crudo. */
export interface Cutoff {
  /** mínimo inclusive */
  min: number;
  /** máximo inclusive */
  max: number;
  /** clave estable del nivel, ej "moderate" */
  level: string;
  /** etiqueta para mostrar, ej "Moderado" */
  label: string;
  /**
   * Tono visual explícito. Útil cuando la valencia se invierte (ej. Rosenberg:
   * "autoestima baja" debe verse como alerta). Si se omite, se deriva del nivel.
   */
  tone?: LevelTone;
}

/**
 * Una subescala suma un conjunto de ítems y lo compara contra sus cortes.
 * Para tests de puntaje único (PHQ-9, GAD-7) se usa una sola subescala
 * (ej key "total") que incluye todos los ítems.
 */
export interface Subscale {
  key: string;
  /** etiqueta para mostrar, ej "Depresión" / "Total" */
  label: string;
  /** números de ítem (1-based) que suman a esta subescala */
  items: number[];
  /** ítems con puntaje invertido: value -> (maxPorÍtem - value). Ej: Rosenberg. */
  reverseItems?: number[];
  /** multiplicador del crudo antes de aplicar cortes. Ej: DASS-21 (x2). */
  multiplier?: number;
  cutoffs: Cutoff[];
}

/** Config de corrección que vive en Test.scoringJson. Extensible a futuros tests. */
export interface ScoringConfig {
  mode: "subscales" | "total";
  subscales: Subscale[];
}

/** Puntaje calculado de una subescala. */
export interface SubscaleScore {
  key: string;
  label: string;
  /** puntaje crudo (suma de ítems) */
  raw: number;
  /** máximo crudo posible (para barras de progreso) */
  max: number;
  /** clave del nivel alcanzado */
  level: string;
  /** etiqueta del nivel, ej "Moderado" */
  levelLabel: string;
  /** tono visual explícito si el corte lo definió (sino se deriva del nivel) */
  tone?: LevelTone;
}

/** Resultado completo de corregir un test (lo que se guarda en Result.scoresJson). */
export interface ScoreResult {
  mode: ScoringConfig["mode"];
  scores: SubscaleScore[];
}

/** Respuestas crudas del paciente: { numeroItem: valor }. */
export type Answers = Record<string | number, number>;

/** Forma mínima del test que necesita el motor (desacoplada de Prisma/UI). */
export interface ScorableTest {
  responseType: ResponseType;
  scoring: ScoringConfig;
  /**
   * Máximo por ítem (1-based) cuando el test define opciones propias por
   * pregunta. Si se omite, el motor usa el máximo del `responseType`.
   */
  itemMax?: Record<number, number>;
}

/** Valor máximo por ítem según el tipo de respuesta. */
export function maxPerItem(responseType: ResponseType): number {
  switch (responseType) {
    case "BOOLEAN":
      return 1;
    case "SCALE_0_3":
    case "SCALE_0_3_FREQ":
    case "SCALE_AGREE_4":
      return 3;
    default:
      return 0;
  }
}
