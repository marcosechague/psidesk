import {
  type Answers,
  type Cutoff,
  type ScorableTest,
  type ScoreResult,
  type Subscale,
  type SubscaleScore,
  maxPerItem,
} from "./types";

/** Encuentra el nivel correspondiente a un puntaje crudo. */
function levelFor(raw: number, cutoffs: Cutoff[]): Cutoff {
  const hit = cutoffs.find((c) => raw >= c.min && raw <= c.max);
  if (hit) return hit;
  // Fallback defensivo: si no cae en ningún rango, usar el último.
  return (
    cutoffs[cutoffs.length - 1] ?? {
      min: 0,
      max: 0,
      level: "unknown",
      label: "—",
    }
  );
}

/** Máximo de un ítem (1-based): el del mapa por ítem o, si no, el del responseType. */
function maxForItem(
  item: number,
  itemMax: Record<number, number> | undefined,
  fallback: number,
): number {
  return itemMax?.[item] ?? fallback;
}

/**
 * Suma los ítems de una subescala. Ítems faltantes cuentan como 0.
 * Los ítems marcados como inversos puntúan (maxDelÍtem - value).
 */
function rawScore(
  items: number[],
  answers: Answers,
  reverse: Set<number>,
  itemMax: Record<number, number> | undefined,
  fallbackMax: number,
): number {
  return items.reduce((sum, item) => {
    const v = answers[item] ?? answers[String(item)] ?? 0;
    const val = Number.isFinite(v) ? Number(v) : 0;
    const perItemMax = maxForItem(item, itemMax, fallbackMax);
    return sum + (reverse.has(item) ? perItemMax - val : val);
  }, 0);
}

function scoreSubscale(
  sub: Subscale,
  answers: Answers,
  itemMax: Record<number, number> | undefined,
  fallbackMax: number,
): SubscaleScore {
  const reverse = new Set(sub.reverseItems ?? []);
  const multiplier = sub.multiplier ?? 1;
  const raw =
    rawScore(sub.items, answers, reverse, itemMax, fallbackMax) * multiplier;
  const maxRaw =
    sub.items.reduce((s, item) => s + maxForItem(item, itemMax, fallbackMax), 0) *
    multiplier;
  const cutoff = levelFor(raw, sub.cutoffs);
  return {
    key: sub.key,
    label: sub.label,
    raw,
    max: maxRaw,
    level: cutoff.level,
    levelLabel: cutoff.label,
    tone: cutoff.tone,
  };
}

/**
 * Motor de corrección — función PURA (sin UI ni DB).
 * Calcula el puntaje y nivel de cada subescala (o del total). El máximo por
 * ítem sale de `test.itemMax` (tests con opciones propias por pregunta) o, si
 * no está, del `responseType` (tests del seed) — ambos caminos dan el mismo
 * resultado para los tests clásicos.
 */
export function scoreTest(test: ScorableTest, answers: Answers): ScoreResult {
  const fallbackMax = maxPerItem(test.responseType);
  const scores = test.scoring.subscales.map((sub) =>
    scoreSubscale(sub, answers, test.itemMax, fallbackMax),
  );
  return { mode: test.scoring.mode, scores };
}
