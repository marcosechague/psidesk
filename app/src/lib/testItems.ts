import type { ResponseType } from "@prisma/client";
import { RESPONSE_OPTIONS, type ResponseOption } from "./responseOptions";

/**
 * Un ítem de un test. Los tests custom guardan las opciones por pregunta;
 * los del seed (legacy) guardan solo el texto y heredan las opciones del
 * `responseType` del test.
 */
export interface TestItem {
  text: string;
  options: ResponseOption[];
}

/**
 * Normaliza `itemsJson` a una forma uniforme `{ text, options }[]`,
 * sin importar si el test es custom (objetos) o del seed (strings).
 */
export function normalizeItems(
  itemsJson: unknown,
  responseType: ResponseType,
): TestItem[] {
  const arr = Array.isArray(itemsJson) ? itemsJson : [];
  const fallback = RESPONSE_OPTIONS[responseType];
  return arr.map((it) => {
    if (typeof it === "string") return { text: it, options: fallback };
    const obj = it as { text?: unknown; options?: ResponseOption[] };
    return {
      text: typeof obj.text === "string" ? obj.text : "",
      options:
        Array.isArray(obj.options) && obj.options.length > 0
          ? obj.options
          : fallback,
    };
  });
}

/** Máximo valor posible por ítem (1-based). Lo usa el motor de corrección. */
export function itemMaxMap(items: TestItem[]): Record<number, number> {
  const map: Record<number, number> = {};
  items.forEach((it, i) => {
    map[i + 1] = it.options.reduce((m, o) => Math.max(m, o.value), 0);
  });
  return map;
}

/** Valores permitidos por ítem (1-based). Lo usa la validación de respuestas. */
export function itemValuesMap(items: TestItem[]): Record<number, number[]> {
  const map: Record<number, number[]> = {};
  items.forEach((it, i) => {
    map[i + 1] = it.options.map((o) => o.value);
  });
  return map;
}
