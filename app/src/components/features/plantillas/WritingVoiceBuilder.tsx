"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { type WritingVoiceInput } from "@/lib/validations";
import { createWritingVoice, updateWritingVoice } from "@/server/actions";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// La voz se edita como una lista de reglas (cada una una instrucción de estilo).
// useFieldArray necesita objetos, así que el form usa {text}[] y al enviar lo
// mapeamos a string[] (WritingVoiceInput).
const voiceFormSchema = z.object({
  name: z.string().min(2, "Ponele un nombre").max(120),
  description: z.string().max(300).optional(),
  rules: z
    .array(
      z.object({
        text: z.string().trim().min(1, "La regla no puede estar vacía").max(300),
      }),
    )
    .min(1, "Agregá al menos una regla")
    .max(20, "Máximo 20 reglas"),
  isDefault: z.boolean().optional(),
});
type VoiceForm = z.infer<typeof voiceFormSchema>;

export function WritingVoiceBuilder({
  mode = "create",
  id,
  initial,
}: {
  mode?: "create" | "edit";
  id?: string;
  initial?: {
    name: string;
    description: string;
    rules: string[];
    isDefault: boolean;
  };
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<VoiceForm>({
    resolver: zodResolver(voiceFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      rules:
        initial?.rules.map((text) => ({ text })) ?? [{ text: "" }],
      isDefault: initial?.isDefault ?? false,
    },
  });

  const rules = useFieldArray({ control: form.control, name: "rules" });

  function onSubmit(values: VoiceForm) {
    const payload: WritingVoiceInput = {
      name: values.name,
      description: values.description,
      rules: values.rules.map((r) => r.text),
      isDefault: values.isDefault,
    };
    startTransition(async () => {
      const res =
        mode === "edit" && id
          ? await updateWritingVoice(id, payload)
          : await createWritingVoice(payload);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voz / estilo</CardTitle>
            <CardDescription>
              Reglas de redacción (tono, largo, forma de las frases). Se aplican a
              todo lo generado: resumen, próximos pasos y mensaje al paciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Breve y directo" {...field} />
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
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Cuándo usar esta voz"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Reglas</FormLabel>
              <FormDescription>
                Una instrucción por línea. Ej: &ldquo;Oraciones cortas, una idea
                por viñeta&rdquo;.
              </FormDescription>
              <div className="space-y-2">
                {rules.fields.map((f, i) => (
                  <FormField
                    key={f.id}
                    control={form.control}
                    name={`rules.${i}.text`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Input
                              placeholder={`Regla ${i + 1}`}
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => rules.remove(i)}
                            disabled={rules.fields.length <= 1}
                            aria-label="Quitar regla"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => rules.append({ text: "" })}
                disabled={rules.fields.length >= 20}
              >
                <Plus className="h-4 w-4" />
                Agregar regla
              </Button>
              {form.formState.errors.rules?.message && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.rules.message}
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div>
                    <FormLabel>Predeterminada</FormLabel>
                    <FormDescription>
                      Se aplica por defecto al generar contenido.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link href="/plantillas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar cambios" : "Crear voz"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
