"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  adminCreateUserSchema,
  type AdminCreateUserInput,
} from "@/lib/validations";
import { adminCreatePsychologist } from "@/server/actions";
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
import { PrefixSelect, SpecialtyPicker } from "@/components/features/profile/fields";

export function AdminCreateUserForm({
  onSaved,
}: {
  /** Si se pasa, se llama al crear (p. ej. para cerrar el modal). Si no, navega al listado. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<AdminCreateUserInput>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      prefix: "",
      specialties: [],
      email: "",
      password: "",
    },
  });

  const specialties = form.watch("specialties") ?? [];

  function onSubmit(values: AdminCreateUserInput) {
    startTransition(async () => {
      const res = await adminCreatePsychologist(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Psicólogo dado de alta");
      form.reset();
      if (onSaved) {
        onSaved();
        router.refresh();
      } else {
        router.push("/admin/psicologos");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Apellido" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="prefix"
          render={({ field }) => (
            <FormItem className="sm:max-w-[12rem]">
              <FormLabel>Prefijo (para los mensajes)</FormLabel>
              <FormControl>
                <PrefixSelect value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SpecialtyPicker
          value={specialties}
          onChange={(v) => form.setValue("specialties", v, { shouldValidate: true })}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="psicologo@ejemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña temporal</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Mínimo 8 caracteres" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-muted-foreground text-sm">
          Pasale esta contraseña al psicólogo; podrá usarla para ingresar y
          luego cambiarla.
        </p>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Dar de alta
        </Button>
      </form>
    </Form>
  );
}
