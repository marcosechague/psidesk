"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";

import { updateAvailability } from "@/server/actions";
import {
  WEEKDAY_LABELS,
  type Availability,
  type TimeRange,
} from "@/lib/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function AvailabilityForm({ initial }: { initial: Availability }) {
  const [days, setDays] = useState<Availability>(initial);
  const [isPending, startTransition] = useTransition();

  function setDay(i: number, ranges: TimeRange[]) {
    setDays((d) => ({ ...d, [String(i)]: ranges }));
  }
  function setRange(
    i: number,
    idx: number,
    field: "start" | "end",
    value: string,
  ) {
    const cur = days[String(i)] ?? [];
    setDay(
      i,
      cur.map((r, k) => (k === idx ? { ...r, [field]: value } : r)),
    );
  }

  function save() {
    startTransition(async () => {
      const res = await updateAvailability({ availability: days });
      if (res?.error) toast.error(res.error);
      else toast.success("Horario guardado");
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {WEEKDAY_LABELS.map((lbl, i) => {
          const ranges = days[String(i)] ?? [];
          const open = ranges.length > 0;
          return (
            <div key={i} className="border-border rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{lbl}</span>
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {open ? "Atiende" : "Cerrado"}
                  </span>
                  <Switch
                    checked={open}
                    onCheckedChange={(c) =>
                      setDay(i, c ? [{ start: "09:00", end: "18:00" }] : [])
                    }
                  />
                </label>
              </div>
              {open && (
                <div className="mt-3 space-y-2">
                  {ranges.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={r.start}
                        onChange={(e) => setRange(i, idx, "start", e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input
                        type="time"
                        value={r.end}
                        onChange={(e) => setRange(i, idx, "end", e.target.value)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDay(
                            i,
                            ranges.filter((_, k) => k !== idx),
                          )
                        }
                        aria-label="Quitar rango"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDay(i, [...ranges, { start: "09:00", end: "18:00" }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Agregar rango
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar horario
        </Button>
      </div>
    </div>
  );
}
