"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { noteTemplateSchema, type NoteTemplateInput } from "@/lib/validations";
import { createNoteTemplate, updateNoteTemplate } from "@/server/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Markdown } from "@/components/ui/markdown";

export function NoteTemplateBuilder({
  mode = "create",
  id,
  initial,
}: {
  mode?: "create" | "edit";
  id?: string;
  initial?: {
    name: string;
    description: string;
    structure: string;
    isDefault: boolean;
  };
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<NoteTemplateInput>({
    resolver: zodResolver(noteTemplateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      structure: initial?.structure ?? "",
      isDefault: initial?.isDefault ?? false,
    },
  });

  const structure = form.watch("structure") ?? "";

  function onSubmit(values: NoteTemplateInput) {
    startTransition(async () => {
      const res =
        mode === "edit" && id
          ? await updateNoteTemplate(id, values)
          : await createNoteTemplate(values);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plantilla</CardTitle>
            <CardDescription>
              Definí qué secciones querés que tenga el resumen. La voz (estilo)
              se elige aparte y se aplica encima.
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
                    <Input placeholder="Ej: Primera sesión" {...field} />
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
                      placeholder="Para qué tipo de sesión la usás"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="structure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estructura</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={10}
                      placeholder={
                        "Describí las secciones. Ej:\n## Motivo de consulta\n## Observación\n## Plan\n\nPodés usar **negrita** y viñetas con -."
                      }
                      className="text-base leading-relaxed"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Esto es la guía que recibe la IA: qué secciones armar y en qué
                    orden. No inventa datos; solo organiza tus notas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div>
                    <FormLabel>Predeterminada</FormLabel>
                    <FormDescription>
                      Se preselecciona al generar el resumen.
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

        {structure.trim() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vista previa</CardTitle>
              <CardDescription>Cómo se interpreta la estructura.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-border rounded-lg border p-3.5 text-base">
                <Markdown content={structure} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link href="/plantillas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar cambios" : "Crear plantilla"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
