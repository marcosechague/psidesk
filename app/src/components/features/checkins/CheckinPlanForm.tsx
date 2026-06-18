"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Sparkles, TriangleAlert } from "lucide-react";

import {
  checkinPlanSchema,
  type CheckinPlanInput,
  CHECKIN_TYPE_OPTIONS,
  CHECKIN_FREQUENCY_OPTIONS,
  WEEKDAY_OPTIONS,
  CHECKIN_PRESETS,
} from "@/lib/validations";
import { createCheckinPlan } from "@/server/actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface CheckinPlanFormProps {
  patientId: string;
  onSaved?: () => void;
}

export function CheckinPlanForm({ patientId, onSaved }: CheckinPlanFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);

  const form = useForm<CheckinPlanInput>({
    resolver: zodResolver(checkinPlanSchema),
    defaultValues: {
      patientId,
      question: "",
      questionType: "SCALE_1_10",
      options: [],
      frequency: "DAILY",
      everyNDays: 2,
      weekdays: [],
      timeOfDay: "09:00",
      startDate: ymd(new Date()),
      endDate: ymd(in14),
    },
  });

  const today = ymd(new Date());
  const questionType = form.watch("questionType");
  const frequency = form.watch("frequency");
  const startDate = form.watch("startDate");
  const options = form.watch("options") ?? [];
  const weekdays = form.watch("weekdays") ?? [];

  function setOptions(next: string[]) {
    form.setValue("options", next, { shouldValidate: true });
  }
  function toggleWeekday(v: number) {
    const next = weekdays.includes(v)
      ? weekdays.filter((d) => d !== v)
      : [...weekdays, v];
    form.setValue("weekdays", next, { shouldValidate: true });
  }
  function applyPreset(p: (typeof CHECKIN_PRESETS)[number]) {
    form.setValue("question", p.question);
    form.setValue("questionType", p.questionType, { shouldValidate: true });
    form.setValue("options", p.options ?? []);
  }

  function onSubmit(values: CheckinPlanInput) {
    setError(null);
    startTransition(async () => {
      const res = await createCheckinPlan(values);
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Seguimiento creado");
      form.reset();
      onSaved?.();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Preguntas predefinidas */}
        <div className="flex flex-wrap gap-2">
          {CHECKIN_PRESETS.map((p) => (
            <Button
              key={p.question}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(p)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {p.question}
            </Button>
          ))}
        </div>

        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pregunta</FormLabel>
              <FormControl>
                <Input placeholder="¿Cómo estuvo tu ánimo hoy?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="questionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de respuesta</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CHECKIN_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {questionType === "CHOICE" && (
          <div className="space-y-2">
            <Label>Opciones</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  placeholder={`Opción ${i + 1}`}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOptions([...options, ""])}
            >
              <Plus className="h-4 w-4" />
              Agregar opción
            </Button>
            {form.formState.errors.options?.message && (
              <p className="text-destructive text-sm">
                {form.formState.errors.options.message}
              </p>
            )}
          </div>
        )}

        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frecuencia</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CHECKIN_FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {frequency === "EVERY_N_DAYS" && (
          <FormField
            control={form.control}
            name="everyNDays"
            render={({ field }) => (
              <FormItem className="sm:max-w-[10rem]">
                <FormLabel>Cada cuántos días</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {frequency === "WEEKDAYS" && (
          <div className="space-y-2">
            <Label>Días de la semana</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    weekdays.includes(d.value)
                      ? "border-primary bg-secondary"
                      : "hover:bg-muted",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {form.formState.errors.weekdays?.message && (
              <p className="text-destructive text-sm">
                {form.formState.errors.weekdays.message}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="timeOfDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora de envío</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Desde</FormLabel>
                <FormControl>
                  <Input type="date" min={today} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hasta</FormLabel>
                <FormControl>
                  <Input type="date" min={startDate || today} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {error && (
          <p className="text-destructive flex items-center gap-1.5 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear seguimiento
        </Button>
      </form>
    </Form>
  );
}
