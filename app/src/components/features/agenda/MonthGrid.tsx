"use client";

import { cn, fixIcuSpaces } from "@/lib/utils";
import { calChipClass, BLOCK_STRIPE_STYLE } from "@/lib/sessionLabels";
import type { CalSession } from "./WeekGrid";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_MS = 86_400_000;

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
function key(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function hhmm(d: Date) {
  return fixIcuSpaces(
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  );
}
export function MonthGrid({
  month,
  sessions,
  onNew,
  onOpen,
  onPickDay,
}: {
  month: Date;
  sessions: CalSession[];
  onNew: (slot: Date) => void;
  onOpen: (id: string) => void;
  onPickDay: (day: Date) => void;
}) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();

  const byDay = new Map<string, CalSession[]>();
  for (const s of sessions) {
    const k = key(new Date(s.startsAt));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(s);
  }
  for (const list of byDay.values()) {
    list.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-muted-foreground py-2 text-center text-xs font-medium"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const inMonth = d.getMonth() === m;
          const isToday = sameDay(d, today);
          const list = byDay.get(key(d)) ?? [];
          return (
            <div
              key={d.toISOString()}
              onClick={() => {
                const slot = new Date(d);
                slot.setHours(10, 0, 0, 0);
                onNew(slot);
              }}
              className={cn(
                "hover:bg-muted/30 min-h-[112px] cursor-pointer border-b border-l p-1.5 transition-colors",
                !inMonth && "bg-muted/20",
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickDay(d);
                }}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : inMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground",
                )}
              >
                {d.getDate()}
              </button>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(s.id);
                    }}
                    style={s.isBlock ? BLOCK_STRIPE_STYLE : undefined}
                    className={cn(
                      "block w-full truncate rounded px-1 py-0.5 text-left text-xs",
                      calChipClass(s.status, s.isBlock),
                    )}
                  >
                    <span className="tabular-nums">{hhmm(new Date(s.startsAt))}</span>{" "}
                    {s.label}
                  </button>
                ))}
                {list.length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickDay(d);
                    }}
                    className="text-muted-foreground px-1 text-xs hover:underline"
                  >
                    +{list.length - 3} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
