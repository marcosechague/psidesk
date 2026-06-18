/**
 * Horario de atención semanal del psicólogo. Se guarda en `User.availability`
 * como JSON: claves "0".."6" (0 = lunes … 6 = domingo) → lista de rangos
 * { start, end } en "HH:MM". `null`/sin configurar = no se sombrea nada.
 */

export const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
]; // índice 0 = lunes

export interface TimeRange {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}
export type Availability = Record<string, TimeRange[]>; // "0".."6"

/** Plantilla por defecto que ofrece el form: Lun–Vie 9–18, finde cerrado. */
export const DEFAULT_AVAILABILITY: Availability = {
  "0": [{ start: "09:00", end: "18:00" }],
  "1": [{ start: "09:00", end: "18:00" }],
  "2": [{ start: "09:00", end: "18:00" }],
  "3": [{ start: "09:00", end: "18:00" }],
  "4": [{ start: "09:00", end: "18:00" }],
  "5": [],
  "6": [],
};

/** Día de la semana con lunes = 0 (para indexar la disponibilidad). */
export function dowMon0(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * ¿La hora entera `hour` cae dentro de algún rango disponible de ese día?
 * Si no hay disponibilidad configurada (null/undefined) devuelve true (no sombrea).
 */
export function hourAvailable(
  av: Availability | null | undefined,
  dow: number,
  hour: number,
): boolean {
  if (!av) return true;
  const ranges = av[String(dow)] ?? [];
  const t = hour * 60;
  return ranges.some((r) => toMin(r.start) <= t && t < toMin(r.end));
}

/** Sanea/normaliza desde JSON arbitrario: claves 0..6, rangos válidos start<end. */
export function normalizeAvailability(input: unknown): Availability {
  const obj = (input ?? {}) as Record<string, unknown>;
  const out: Availability = {};
  for (let i = 0; i < 7; i++) {
    const key = String(i);
    const raw = obj[key];
    const ranges: TimeRange[] = [];
    if (Array.isArray(raw)) {
      for (const r of raw) {
        const start = (r as { start?: unknown })?.start;
        const end = (r as { end?: unknown })?.end;
        if (
          typeof start === "string" &&
          typeof end === "string" &&
          /^\d{2}:\d{2}$/.test(start) &&
          /^\d{2}:\d{2}$/.test(end) &&
          toMin(start) < toMin(end)
        ) {
          ranges.push({ start, end });
        }
      }
    }
    out[key] = ranges;
  }
  return out;
}
