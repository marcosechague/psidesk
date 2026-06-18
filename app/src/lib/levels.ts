/**
 * Mapea el nivel de severidad de una subescala a un "tono" visual.
 * Las clases son literales estáticas para que Tailwind las detecte
 * (los colores level-* se definen como tokens en globals.css).
 */
import type { LevelTone, SubscaleScore } from "@/lib/scoring/types";

export type { LevelTone };

/** Etiqueta legible por tono visual (para resúmenes y distribuciones). */
export const TONE_LABEL: Record<LevelTone, string> = {
  ok: "Normal / Bajo",
  low: "Leve",
  mid: "Moderado",
  high: "Alto",
  max: "Muy alto",
};

const LEVEL_TONE: Record<string, LevelTone> = {
  normal: "ok",
  minimal: "ok",
  low: "ok",
  mild: "low",
  moderate: "mid",
  moderate_severe: "high",
  severe: "high",
  high: "high",
  extreme: "max",
};

export function levelTone(level: string): LevelTone {
  return LEVEL_TONE[level] ?? "mid";
}

/** Clases para la barra (fondo sólido). */
export const TONE_BAR: Record<LevelTone, string> = {
  ok: "bg-level-ok",
  low: "bg-level-low",
  mid: "bg-level-mid",
  high: "bg-level-high",
  max: "bg-level-max",
};

/** Clases para el badge de nivel (fondo tenue + texto). */
export const TONE_BADGE: Record<LevelTone, string> = {
  ok: "bg-level-ok/15 text-level-ok border-level-ok/30",
  low: "bg-level-low/15 text-level-low border-level-low/30",
  mid: "bg-level-mid/15 text-level-mid border-level-mid/30",
  high: "bg-level-high/15 text-level-high border-level-high/30",
  max: "bg-level-max/15 text-level-max border-level-max/30",
};

/** Color crudo (CSS var) por tono — para gráficos (recharts, fills inline). */
export const TONE_COLOR: Record<LevelTone, string> = {
  ok: "var(--level-ok)",
  low: "var(--level-low)",
  mid: "var(--level-mid)",
  high: "var(--level-high)",
  max: "var(--level-max)",
};

/** Orden de severidad para comparar tomas (mayor = peor). */
export const TONE_RANK: Record<LevelTone, number> = {
  ok: 0,
  low: 1,
  mid: 2,
  high: 3,
  max: 4,
};

/** Peor tono entre las subescalas de un resultado. */
export function worstTone(scores: SubscaleScore[]): LevelTone {
  let worst: LevelTone = "ok";
  for (const s of scores) {
    const t = s.tone ?? levelTone(s.level);
    if (TONE_RANK[t] > TONE_RANK[worst]) worst = t;
  }
  return worst;
}
