import { fixIcuSpaces } from "@/lib/utils";

const LOCALE = "es-AR";

/**
 * Zona horaria del producto. Psidesk opera en Paraguay, así que toda fecha/hora
 * se muestra en hora de Asunción sin importar dónde corra el render (servidor en
 * UTC, browser en otra zona). Fijarla evita horas corridas e hidratación
 * inconsistente entre SSR y cliente.
 */
export const TIMEZONE = "America/Asuncion";

/** dd/mm/aaaa */
export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(LOCALE, { timeZone: TIMEZONE });
}

/** Fecha + hora. "short": "lun 03 jun, 15:00". "long": "lunes 3 de junio, 15:00". */
export function fmtDateTime(
  d: Date | string,
  variant: "short" | "long" = "short",
): string {
  const opts: Intl.DateTimeFormatOptions =
    variant === "long"
      ? { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" };
  return fixIcuSpaces(
    new Date(d).toLocaleString(LOCALE, { ...opts, timeZone: TIMEZONE }),
  );
}

/** "15:00" */
export function fmtTime(d: Date | string): string {
  return fixIcuSpaces(
    new Date(d).toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIMEZONE,
    }),
  );
}

/** "03 jun" */
export function fmtDayMonth(d: Date | string): string {
  return new Date(d).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "short",
    timeZone: TIMEZONE,
  });
}

/** Partes de hora-de-pared en la zona del producto (para inputs datetime-local). */
function wallClockParts(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const out: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = p.value;
  return out;
}

/** "aaaa-mm-dd" en hora de Asunción (valor para <input type="date">). */
export function ymdInTz(d: Date): string {
  const p = wallClockParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "HH:MM" en hora de Asunción (valor para <input type="time">). */
export function hmInTz(d: Date): string {
  const p = wallClockParts(d);
  // hour12:false puede devolver "24" a medianoche en algunos motores.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${hour}:${p.minute}`;
}
