"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  patientSchema,
  type PatientInput,
  SEX_OPTIONS,
  MARITAL_OPTIONS,
  MOTIVO_OPTIONS,
} from "@/lib/validations";
import { createPatient, updatePatient } from "@/server/actions";
import { SECTION_LABEL } from "@/lib/ui";
import { ageFromBirthDate, toDateInputValue } from "@/lib/patients";
import {
  COUNTRY_CODES,
  composePhone,
  countryByDial,
  splitPhone,
} from "@/lib/phone";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PatientEditData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsappOptIn: boolean;
  /** fecha de nacimiento como "YYYY-MM-DD" (para el input date) */
  birthDate: string | null;
  sex: string | null;
  maritalStatus: string | null;
}

export function PatientForm({
  patient,
  onSaved,
}: {
  patient?: PatientEditData;
  onSaved?: () => void;
} = {}) {
  const [isPending, startTransition] = useTransition();
  const editing = Boolean(patient);
  const todayStr = toDateInputValue(new Date());
  const form = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: patient?.firstName ?? "",
      lastName: patient?.lastName ?? "",
      email: patient?.email ?? "",
      phone: patient?.phone ?? "",
      whatsappOptIn: patient?.whatsappOptIn ?? false,
      birthDate: patient?.birthDate ?? "",
      sex: (patient?.sex as PatientInput["sex"]) ?? undefined,
      maritalStatus:
        (patient?.maritalStatus as PatientInput["maritalStatus"]) ?? undefined,
      motivoCategoria: "",
      motivoConsulta: "",
    },
  });

  const birthAge = ageFromBirthDate(form.watch("birthDate") || null);

  function onSubmit(values: PatientInput) {
    startTransition(async () => {
      const res = patient
        ? await updatePatient(patient.id, values)
        : await createPatient(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (editing) {
        toast.success("Paciente actualizado");
        onSaved?.();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (opcional)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="paciente@ejemplo.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono / WhatsApp (opcional)</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsappOptIn"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 h-4 w-4"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <span>El paciente acepta recibir mensajes por WhatsApp</span>
              </label>
              <p className="text-muted-foreground text-xs">
                Recordatorios de cita, avisos, tests y seguimiento se envían{" "}
                <strong>solo por WhatsApp</strong>. Sin teléfono y consentimiento,
                el paciente no recibe estos mensajes.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Fecha de nacimiento
                  {birthAge !== null && (
                    <span className="text-muted-foreground ml-1 font-normal">
                      · {birthAge} años
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    max={todayStr}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sexo</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v ?? undefined)}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SEX_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maritalStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado civil</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v ?? undefined)}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MARITAL_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!editing && (
          <div className="space-y-5 rounded-lg border border-dashed p-4">
            <p className={SECTION_LABEL}>
              Motivo de consulta (opcional)
            </p>
            <FormField
              control={form.control}
              name="motivoCategoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v ?? undefined)}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MOTIVO_OPTIONS.map((o) => (
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
            <FormField
              control={form.control}
              name="motivoConsulta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalle</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Por qué consulta… (lo podés editar después)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Guardar cambios" : "Guardar paciente"}
        </Button>
      </form>
    </Form>
  );
}

/** Teléfono = selector de código de país (Paraguay por defecto) + número local.
 *  Guarda en formato +<dial><local> y descarta ceros a la izquierda del local. */
function PhoneInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Estado inicial derivado del valor guardado (solo al montar).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => splitPhone(value), []);
  const [dial, setDial] = useState(initial.dial);
  const [local, setLocal] = useState(initial.local);

  function update(nextDial: string, nextLocal: string) {
    setDial(nextDial);
    setLocal(nextLocal);
    onChange(composePhone(nextDial, nextLocal));
  }

  const placeholder = countryByDial(dial)?.placeholder ?? "";

  return (
    <div className="flex gap-2">
      <Select value={dial} onValueChange={(v) => update(v ?? dial, local)}>
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            {() => `${countryByDial(dial)?.flag ?? ""} +${dial}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.iso} value={c.dial}>
              {c.flag} {c.label} +{c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={local}
        onChange={(e) => update(dial, e.target.value)}
      />
    </div>
  );
}
