"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations";
import { changeOwnPassword } from "@/server/actions";
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

export function ChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const res = await changeOwnPassword(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contraseña actualizada");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repetir contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Repetí la contraseña" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar y continuar
        </Button>
      </form>
    </Form>
  );
}
