"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { profileSchema, type ProfileInput } from "@/lib/validations";
import { updateProfile } from "@/server/actions";
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
import { PrefixSelect, SpecialtyPicker } from "./fields";

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const specialties = form.watch("specialties") ?? [];

  function onSubmit(values: ProfileInput) {
    startTransition(async () => {
      const res = await updateProfile(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Perfil actualizado");
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Marcos" {...field} />
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
                  <Input placeholder="Echague" {...field} />
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

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </form>
    </Form>
  );
}
