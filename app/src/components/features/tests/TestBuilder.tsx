"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";

import {
  testSchema,
  type TestInput,
  maxTotalScore,
  TEST_CATEGORY_OPTIONS,
} from "@/lib/validations";
import { createTest } from "@/server/actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Presets de escala de respuesta más comunes en clínica.
const PRESETS: { key: string; label: string; options: TestInput["options"] }[] =
  [
    {
      key: "freq",
      label: "Frecuencia (0–3)",
      options: [
        { value: 0, label: "Nunca" },
        { value: 1, label: "A veces" },
        { value: 2, label: "Frecuentemente" },
        { value: 3, label: "Casi siempre" },
      ],
    },
    {
      key: "agree",
      label: "Nivel de acuerdo (0–3)",
      options: [
        { value: 0, label: "Muy en desacuerdo" },
        { value: 1, label: "En desacuerdo" },
        { value: 2, label: "De acuerdo" },
        { value: 3, label: "Muy de acuerdo" },
      ],
    },
    {
      key: "yesno",
      label: "Sí / No",
      options: [
        { value: 0, label: "No" },
        { value: 1, label: "Sí" },
      ],
    },
  ];

export function TestBuilder() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<TestInput>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      name: "",
      description: "",
      categories: [],
      showResultsToPatient: false,
      options: PRESETS[0].options,
      items: [{ text: "" }],
      cutoffs: [{ min: 0, max: 0, label: "" }],
    },
  });

  const options = useFieldArray({ control: form.control, name: "options" });
  const items = useFieldArray({ control: form.control, name: "items" });
  const cutoffs = useFieldArray({ control: form.control, name: "cutoffs" });

  // Puntaje máximo posible = mayor valor de la escala × cantidad de preguntas.
  const watchedOptions = form.watch("options");
  const watchedItems = form.watch("items");
  const categories = form.watch("categories") ?? [];
  const maxTotal = maxTotalScore(watchedOptions ?? [], watchedItems?.length ?? 0);

  /** Reparte 0..maxTotal en rangos contiguos del mismo tamaño, conservando labels. */
  function autoDistributeCutoffs() {
    const n = cutoffs.fields.length;
    if (n === 0 || maxTotal <= 0) return;
    const size = Math.floor((maxTotal + 1) / n);
    const current = form.getValues("cutoffs");
    const next = current.map((c, i) => {
      const min = i * size;
      const max = i === n - 1 ? maxTotal : (i + 1) * size - 1;
      return { ...c, min, max };
    });
    form.setValue("cutoffs", next, { shouldValidate: true });
  }

  function onSubmit(values: TestInput) {
    startTransition(async () => {
      const res = await createTest(values);
      if (res?.error) toast.error(res.error);
    });
  }

  const errors = form.formState.errors;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Propósito */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Propósito</CardTitle>
            <CardDescription>Qué mide el test y para quién.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del test</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Escala de ansiedad" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Qué evalúa, en qué pacientes se usa, en qué período pensar al responder…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label>Categorías</Label>
              <div className="flex flex-wrap gap-1.5">
                {TEST_CATEGORY_OPTIONS.map((c) => {
                  const active = categories.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() =>
                        form.setValue(
                          "categories",
                          active
                            ? categories.filter((x) => x !== c.value)
                            : [...categories, c.value],
                          { shouldValidate: true },
                        )
                      }
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        active ? "border-primary bg-secondary" : "hover:bg-muted",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {form.formState.errors.categories?.message && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.categories.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary h-4 w-4"
                {...form.register("showResultsToPatient")}
              />
              Mostrar el resultado al paciente al terminar
            </label>
          </CardContent>
        </Card>

        {/* 2. Escala de respuesta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escala de respuesta</CardTitle>
            <CardDescription>
              Las opciones que verá el paciente en cada pregunta, con su puntaje.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => options.replace(p.options)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {options.fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    aria-label="Puntaje"
                    className="w-20"
                    {...form.register(`options.${i}.value`, {
                      valueAsNumber: true,
                    })}
                  />
                  <Input
                    aria-label="Etiqueta"
                    placeholder="Ej: A veces"
                    {...form.register(`options.${i}.label`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => options.remove(i)}
                    disabled={options.fields.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => options.append({ value: options.fields.length, label: "" })}
            >
              <Plus className="h-4 w-4" />
              Agregar opción
            </Button>
            {errors.options?.message && (
              <p className="text-destructive text-sm">
                {errors.options.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Preguntas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preguntas</CardTitle>
            <CardDescription>
              {items.fields.length}{" "}
              {items.fields.length === 1 ? "pregunta" : "preguntas"} · puntaje
              máximo posible: <strong>{maxTotal}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <span className="text-muted-foreground w-6 pt-2.5 text-right text-sm">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <Textarea
                    rows={2}
                    placeholder="Escribí la pregunta o afirmación…"
                    {...form.register(`items.${i}.text`)}
                  />
                  {errors.items?.[i]?.text?.message && (
                    <p className="text-destructive mt-1 text-xs">
                      {errors.items[i]?.text?.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-1"
                  onClick={() => items.remove(i)}
                  disabled={items.fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => items.append({ text: "" })}
            >
              <Plus className="h-4 w-4" />
              Agregar pregunta
            </Button>
            {errors.items?.message && (
              <p className="text-destructive text-sm">{errors.items.message}</p>
            )}
          </CardContent>
        </Card>

        {/* 4. Interpretación */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interpretación</CardTitle>
            <CardDescription>
              Rangos de puntaje y su significado. Deben cubrir de 0 a {maxTotal}{" "}
              sin huecos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {cutoffs.fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    aria-label="Desde"
                    className="w-20"
                    {...form.register(`cutoffs.${i}.min`, {
                      valueAsNumber: true,
                    })}
                  />
                  <span className="text-muted-foreground text-sm">a</span>
                  <Input
                    type="number"
                    aria-label="Hasta"
                    className="w-20"
                    {...form.register(`cutoffs.${i}.max`, {
                      valueAsNumber: true,
                    })}
                  />
                  <Input
                    aria-label="Etiqueta del nivel"
                    placeholder="Ej: Moderado"
                    {...form.register(`cutoffs.${i}.label`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => cutoffs.remove(i)}
                    disabled={cutoffs.fields.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => cutoffs.append({ min: 0, max: 0, label: "" })}
              >
                <Plus className="h-4 w-4" />
                Agregar rango
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoDistributeCutoffs}
                disabled={maxTotal <= 0}
              >
                <Wand2 className="h-4 w-4" />
                Repartir en partes iguales
              </Button>
            </div>
            {errors.cutoffs?.message && (
              <p className="text-destructive text-sm">
                {errors.cutoffs.message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear test
          </Button>
        </div>
      </form>
    </Form>
  );
}
