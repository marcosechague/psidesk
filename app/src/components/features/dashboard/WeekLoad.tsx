import { cn } from "@/lib/utils";

export interface WeekDay {
  label: string;
  count: number;
  isToday: boolean;
}

/** Mini-gráfico operativo: sesiones por día de la semana actual (barras CSS). */
export function WeekLoad({ data }: { data: WeekDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      <div className="flex h-24 items-end gap-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className={cn(
                "w-full rounded-t",
                d.count === 0
                  ? "bg-border"
                  : d.isToday
                    ? "bg-primary"
                    : "bg-secondary",
              )}
              style={{
                height: d.count === 0 ? "2px" : `${Math.max(8, (d.count / max) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center text-xs",
              d.isToday ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
