"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { fixIcuSpaces } from "@/lib/utils";
import {
  hourAvailable,
  dowMon0,
  type Availability,
} from "@/lib/availability";
import { calBlockClass, BLOCK_STRIPE_STYLE } from "@/lib/sessionLabels";

export interface CalSession {
  id: string;
  startsAt: Date | string;
  durationMin: number;
  status: string;
  label: string;
  /** evento sin paciente (bloqueo de horario): se pinta distinto. */
  isBlock?: boolean;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const START_HOUR = 7;
const END_HOUR = 22; // exclusivo: última franja 21:00
const HOUR_PX = 56;
const DAY_MS = 86_400_000;

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function hhmm(d: Date) {
  return fixIcuSpaces(
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  );
}

/** Hora actual, refrescada cada minuto (para la línea de "ahora"). */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function WeekGrid({
  weekStart,
  dayCount = 7,
  sessions,
  availability,
  onNew,
  onOpen,
}: {
  weekStart: Date;
  /** cuántos días mostrar desde weekStart (7 = semana, 1 = día). */
  dayCount?: number;
  sessions: CalSession[];
  /** horario de atención; las horas fuera se sombrean. null = no sombrea */
  availability?: Availability | null;
  onNew: (slot: Date) => void;
  onOpen: (id: string) => void;
}) {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const gridCols = `56px repeat(${dayCount}, 1fr)`;
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i,
  );
  const today = useNow();
  // Posición de la línea de "ahora" (en px desde el tope de la grilla).
  const nowF = today.getHours() + today.getMinutes() / 60 - START_HOUR;
  const nowVisible = nowF >= 0 && nowF <= hours.length;
  const nowTop = nowF * HOUR_PX;

  // Al abrir, centrar la hora actual dentro del scroll de la grilla (una sola
  // vez). Ajusta solo el scroll del contenedor, sin mover la página.
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = scrollRef.current;
    const el = nowRef.current;
    if (!c || !el) return;
    const delta =
      el.getBoundingClientRect().top -
      c.getBoundingClientRect().top -
      c.clientHeight / 2;
    c.scrollTop += delta;
  }, []);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: dayCount === 1 ? 280 : 760 }}>
        {/* Scroll vertical propio: el encabezado de días queda fijo arriba */}
        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
          {/* Cabecera de días (sticky) */}
          <div
            className="bg-background sticky top-0 z-30 grid border-b"
            style={{ gridTemplateColumns: gridCols }}
          >
          <div />
          {days.map((d) => {
            const isToday = sameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className="border-l px-2 py-2 text-center"
              >
                <div className="text-muted-foreground text-xs">
                  {WEEKDAYS[(d.getDay() + 6) % 7]}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo: gutter de horas + columnas de día */}
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {/* Gutter de horas */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="text-muted-foreground relative -top-2 pr-2 text-right text-xs"
              >
                {h}:00
              </div>
            ))}
            {/* Hora actual, alineada con la línea de "ahora" */}
            {nowVisible && (
              <span
                className="bg-level-high absolute right-1 -translate-y-1/2 rounded px-1 text-[10px] font-medium tabular-nums text-white"
                style={{ top: nowTop }}
              >
                {hhmm(today)}
              </span>
            )}
          </div>

          {/* Columnas de día */}
          {days.map((d) => {
            const daySessions = sessions.filter((s) =>
              sameDay(new Date(s.startsAt), d),
            );
            const isToday = sameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className="relative border-l"
                style={{ height: HOUR_PX * hours.length }}
              >
                {/* Línea de "ahora" (solo hoy, dentro del rango visible) */}
                {isToday && nowVisible && (
                  <div
                    ref={nowRef}
                    className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
                    style={{ top: nowTop }}
                    aria-hidden
                  >
                    <span className="bg-level-high -ml-1 h-2 w-2 shrink-0 rounded-full" />
                    <span className="bg-level-high h-px flex-1" />
                  </div>
                )}

                {/* Franjas horarias clickeables (nueva sesión); fuera del
                    horario de atención van sombreadas. */}
                {hours.map((h) => {
                  const off = !hourAvailable(availability, dowMon0(d), h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const slot = new Date(d);
                        slot.setHours(h, 0, 0, 0);
                        onNew(slot);
                      }}
                      style={{ height: HOUR_PX }}
                      className={cn(
                        "block w-full border-t transition-colors",
                        off
                          ? "bg-muted/50 hover:bg-muted/70"
                          : "hover:bg-muted/50",
                      )}
                      aria-label={`Nueva sesión ${d.getDate()} ${h}:00`}
                    />
                  );
                })}

                {/* Bloques de sesión */}
                {daySessions.map((s) => {
                  const start = new Date(s.startsAt);
                  const startF =
                    start.getHours() + start.getMinutes() / 60 - START_HOUR;
                  const top = Math.max(0, startF * HOUR_PX);
                  const height = Math.max((s.durationMin / 60) * HOUR_PX, 22);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpen(s.id)}
                      style={
                        s.isBlock ? { top, height, ...BLOCK_STRIPE_STYLE } : { top, height }
                      }
                      className={cn(
                        "absolute right-1 left-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs",
                        calBlockClass(s.status, s.isBlock),
                      )}
                    >
                      <span className="block font-medium tabular-nums">
                        {hhmm(start)}
                      </span>
                      <span className="block truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
