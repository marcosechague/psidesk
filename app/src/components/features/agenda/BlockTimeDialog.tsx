"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Loader2, CalendarClock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { createBlock } from "@/server/actions";
import { DURATION_OPTIONS } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "single" | "range" | "always";

/**
 * "Bloquear horario": crea un bloqueo sin paciente (supervisión, vacaciones,
 * "ocupado") como Session sin participantes. Un día, un rango (un Session por
 * día) o, para lo recurrente/"siempre", deriva al horario de atención.
 */
export function BlockTimeDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [time, setTime] = useState("13:00");
  const [durationMin, setDurationMin] = useState(60);
  const [allDay, setAllDay] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setMode("single");
    setTitle("");
    setStartDate(defaultDate);
    setEndDate(defaultDate);
    setTime("13:00");
    setDurationMin(60);
    setAllDay(false);
  }

  function save() {
    if (title.trim().length === 0) {
      toast.error("Ponele un motivo al bloqueo");
      return;
    }
    startTransition(async () => {
      const res = await createBlock({
        title: title.trim(),
        startDate,
        endDate: mode === "range" ? endDate : undefined,
        allDay,
        time: allDay ? undefined : time,
        durationMin: allDay ? undefined : durationMin,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.count && res.count > 1
          ? `Bloqueados ${res.count} días`
          : "Horario bloqueado",
      );
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setStartDate(defaultDate);
          setEndDate(defaultDate);
        }
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" />
        Bloquear horario
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>
            Reservá un rato sin paciente (supervisión, vacaciones, ocupado).
            Aparece en el calendario como un bloqueo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { key: "single", label: "Un día" },
              { key: "range", label: "Rango" },
              { key: "always", label: "Siempre" },
            ]}
          />

          {mode === "always" ? (
            // Lo recurrente/"siempre" no son bloqueos sueltos: es tu disponibilidad.
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Algo que se repite siempre</p>
                  <p className="text-muted-foreground">
                    Un horario que no atendés todas las semanas (almuerzo, una
                    mañana libre) se configura en tu <strong>horario de
                    atención</strong>: en el calendario se sombrean las horas
                    fuera de atención, sin crear bloqueos uno por uno.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href="/perfil#horario">
                  Ir al horario de atención
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="block-title">Motivo</Label>
                <Input
                  id="block-title"
                  placeholder="Ej: Supervisión, vacaciones…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              {mode === "single" ? (
                <div className="space-y-2 sm:max-w-[12rem]">
                  <Label htmlFor="block-date">Fecha</Label>
                  <Input
                    id="block-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="block-start">Desde</Label>
                    <Input
                      id="block-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-end">Hasta</Label>
                    <Input
                      id="block-end"
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 sm:max-w-md">
                <div>
                  <Label>Todo el día</Label>
                  <p className="text-muted-foreground text-xs">
                    Ocupa toda la jornada. Apagalo para bloquear solo una franja.
                  </p>
                </div>
                <Switch checked={allDay} onCheckedChange={setAllDay} />
              </div>

              {!allDay && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="block-time">Hora</Label>
                    <Input
                      id="block-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duración</Label>
                    <Select
                      value={String(durationMin)}
                      onValueChange={(v) => setDurationMin(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{() => `${durationMin} min`}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Button disabled={isPending} onClick={save}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Bloquear
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
