"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, X, UserPlus, Users, Trash2 } from "lucide-react";

import {
  sessionSchema,
  type SessionInput,
  DURATION_OPTIONS,
  REMINDER_OFFSET_OPTIONS,
  TOPIC_OPTIONS,
  SESSION_STATUS_OPTIONS,
  MOTIVO_OPTIONS,
} from "@/lib/validations";
import {
  createSession,
  updateSession,
  quickCreatePatient,
  createGroup,
  deleteSession,
} from "@/server/actions";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ymdInTz, hmInTz } from "@/lib/format";

/** Paciente con su tratamiento en curso (para preseleccionarlo en el form). */
export interface SchedulingPatient {
  id: string;
  fullName: string;
  activeProcess?: { id: string; label: string | null } | null;
}

export interface SessionEditData {
  id: string;
  participantIds: string[];
  title: string | null;
  startsAt: Date | string;
  durationMin: number;
  status: string;
  topic: string | null;
  topicOther: string | null;
  observations: string | null;
  goals: string | null;
  nextSteps: string | null;
  reminderOffsetMin: number | null;
  notifyPatient?: boolean | null;
  groupId?: string | null;
}

interface SessionFormProps {
  patients: SchedulingPatient[];
  /** YYYY-MM-DD por defecto al crear desde el calendario. */
  defaultDate?: string;
  /** HH:MM por defecto al crear desde una franja del calendario. */
  defaultTime?: string;
  /** Bloquea el paciente (al crear desde la ficha de un paciente). */
  lockedPatientId?: string;
  /** Grupos guardados (atajo): al elegir uno se cargan sus miembros. */
  groups?: { id: string; name: string; memberIds: string[] }[];
  /** Si viene, el form edita esta sesión en vez de crear una nueva. */
  session?: SessionEditData;
  /** El psicólogo tiene habilitados los avisos de cita por WhatsApp. */
  canNotify?: boolean;
  onSaved?: () => void;
}

const NONE = "none";

// Hora de pared en la zona del producto (Asunción), no la del browser.
const ymd = ymdInTz;
const hm = hmInTz;

type Kind = "individual" | "group";

export function SessionForm({
  patients,
  defaultDate,
  defaultTime,
  lockedPatientId,
  groups,
  session,
  canNotify,
  onSaved,
}: SessionFormProps) {
  const [isPending, startTransition] = useTransition();
  const editing = Boolean(session);
  const startsAt = session ? new Date(session.startsAt) : null;
  // Bloque sin paciente ya existente (solo se edita; los nuevos se crean desde
  // "Bloquear horario" en el calendario).
  const editingBlock = editing && (session?.participantIds.length ?? 0) === 0;

  // Lista local para poder sumar pacientes creados al vuelo (quick-create).
  const [patientList, setPatientList] = useState<SchedulingPatient[]>(patients);

  const initialKind: Kind =
    !lockedPatientId &&
    ((session?.participantIds.length ?? 0) >= 2 || Boolean(session?.groupId))
      ? "group"
      : "individual";
  const [kind, setKind] = useState<Kind>(initialKind);

  // Estado del quick-create de paciente y del "guardar como grupo".
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [savingGroupName, setSavingGroupName] = useState<string | null>(null);

  const form = useForm<SessionInput>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      participantIds:
        session?.participantIds ?? (lockedPatientId ? [lockedPatientId] : []),
      title: session?.title ?? "",
      date: startsAt ? ymd(startsAt) : (defaultDate ?? ymd(new Date())),
      time: startsAt ? hm(startsAt) : (defaultTime ?? "10:00"),
      durationMin: session?.durationMin ?? 50,
      status: (session?.status as SessionInput["status"]) ?? "SCHEDULED",
      topic: (session?.topic as SessionInput["topic"]) ?? undefined,
      topicOther: session?.topicOther ?? "",
      groupId: session?.groupId ?? "",
      reminderOffsetMin: session ? session.reminderOffsetMin : 1440,
      notifyPatient: session?.notifyPatient ?? true,
      treatmentMode: "active",
      treatmentMotivoCategoria: "",
      treatmentMotivoConsulta: "",
    },
  });

  const participantIds = form.watch("participantIds");
  const topic = form.watch("topic");
  const groupId = form.watch("groupId");
  const treatmentMode = form.watch("treatmentMode") ?? "active";
  const byId = new Map(patientList.map((p) => [p.id, p]));
  const available = patientList.filter((p) => !participantIds.includes(p.id));

  // Tratamiento del paciente seleccionado (solo aplica a sesión individual).
  const selectedPatient =
    kind === "individual" ? byId.get(participantIds[0] ?? "") : undefined;
  const activeProcess = selectedPatient?.activeProcess ?? null;

  function switchKind(next: Kind) {
    setKind(next);
    setShowNewPatient(false);
    setSavingGroupName(null);
    // Al pasar a individual dejamos un solo paciente; el grupo guardado se suelta.
    if (next === "individual") {
      form.setValue("participantIds", participantIds.slice(0, 1));
    }
    form.setValue("groupId", "");
  }

  function addParticipant(id: string | null) {
    if (!id || id === NONE) return;
    if (kind === "individual") {
      form.setValue("participantIds", [id]);
    } else if (!participantIds.includes(id)) {
      form.setValue("participantIds", [...participantIds, id]);
    }
    form.setValue("groupId", "");
  }

  function onPatientCreated(p: SchedulingPatient) {
    setPatientList((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    addParticipant(p.id);
    setShowNewPatient(false);
  }

  function saveAsGroup() {
    const name = (savingGroupName ?? "").trim();
    if (name.length < 2) {
      toast.error("Ingresá un nombre para el grupo");
      return;
    }
    startTransition(async () => {
      const res = await createGroup({ name, patientIds: participantIds });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res.id) form.setValue("groupId", res.id);
      setSavingGroupName(null);
      toast.success("Grupo guardado");
    });
  }

  function onSubmit(values: SessionInput) {
    startTransition(async () => {
      const res = session
        ? await updateSession(session.id, values)
        : await createSession(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Sesión actualizada" : "Sesión guardada");
      if (!editing) form.reset();
      onSaved?.();
    });
  }

  // ── Bloqueo existente: detalles editables + "Desbloquear" (sin estado, no
  //    es una cita clínica). ──────────────────────────────────────────────────
  function deleteBlock() {
    if (!session) return;
    startTransition(async () => {
      const res = await deleteSession(session.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Bloqueo eliminado");
      onSaved?.();
    });
  }

  if (editingBlock) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo del bloqueo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Supervisión, vacaciones…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <WhenFields form={form} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={deleteBlock}
            >
              <Trash2 className="h-4 w-4" />
              Desbloquear
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Tipo de sesión: define cómo se eligen los participantes. */}
        {!lockedPatientId && (
          <FormItem>
            <FormLabel>Tipo de sesión</FormLabel>
            <div>
              <Segmented<Kind>
                value={kind}
                onChange={switchKind}
                options={[
                  { key: "individual", label: "Individual" },
                  { key: "group", label: "Pareja / familia" },
                ]}
              />
            </div>
          </FormItem>
        )}

        {/* ── Individual ──────────────────────────────────────────────── */}
        {kind === "individual" &&
          (lockedPatientId ? (
            <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm">
              {byId.get(lockedPatientId)?.fullName ?? "Paciente"}
            </div>
          ) : (
            <FormField
              control={form.control}
              name="participantIds"
              render={() => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <div className="flex gap-2">
                    <Select
                      value={participantIds[0] ?? NONE}
                      onValueChange={(v) => addParticipant(v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegí un paciente">
                            {() =>
                              byId.get(participantIds[0] ?? "")?.fullName ??
                              "Elegí un paciente"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patientList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setShowNewPatient((v) => !v)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Nuevo
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

        {/* ── Pareja / familia ────────────────────────────────────────── */}
        {kind === "group" && (
          <div className="space-y-3">
            {groups && groups.length > 0 && (
              <FormItem className="sm:max-w-sm">
                <FormLabel>
                  Grupo guardado{" "}
                  <span className="text-muted-foreground font-normal">
                    · opcional, carga los miembros
                  </span>
                </FormLabel>
                <Select
                  value={form.watch("groupId") || NONE}
                  onValueChange={(v) => {
                    if (!v || v === NONE) {
                      form.setValue("groupId", "");
                      return;
                    }
                    form.setValue("groupId", v);
                    const g = groups.find((x) => x.id === v);
                    if (g) form.setValue("participantIds", g.memberIds);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin grupo guardado">
                        {() =>
                          groups.find((g) => g.id === groupId)?.name ??
                          "Sin grupo guardado"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin grupo guardado</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="participantIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Pacientes{" "}
                    <span className="text-muted-foreground font-normal">
                      · 2 o más (pareja / familia)
                    </span>
                  </FormLabel>
                  {participantIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {participantIds.map((id) => (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {byId.get(id)?.fullName ?? "Paciente"}
                          <button
                            type="button"
                            aria-label="Quitar paciente"
                            onClick={() => {
                              field.onChange(
                                participantIds.filter((x) => x !== id),
                              );
                              form.setValue("groupId", "");
                            }}
                            className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Select
                      value={NONE}
                      onValueChange={(v) => {
                        if (v === NONE) return;
                        addParticipant(v);
                      }}
                      disabled={available.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Agregar paciente…">
                            {() => "Agregar paciente…"}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {available.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setShowNewPatient((v) => !v)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Nuevo
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Guardar la combinación elegida como grupo reutilizable. */}
            {participantIds.length >= 2 &&
              !form.watch("groupId") &&
              (savingGroupName === null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setSavingGroupName("")}
                >
                  <Users className="h-4 w-4" />
                  Guardar como grupo
                </Button>
              ) : (
                <div className="flex gap-2 sm:max-w-sm">
                  <Input
                    autoFocus
                    placeholder="Nombre del grupo (ej: Familia Pérez)"
                    value={savingGroupName}
                    onChange={(e) => setSavingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveAsGroup();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={isPending}
                    onClick={saveAsGroup}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setSavingGroupName(null)}
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>
        )}

        {/* Quick-create de paciente (compartido por ambos tipos). */}
        {showNewPatient && (
          <QuickPatient
            onCreated={onPatientCreated}
            onCancel={() => setShowNewPatient(false)}
          />
        )}

        <WhenFields form={form} />

        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem className="sm:max-w-sm">
              <FormLabel>Motivo / tema del día</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin especificar">
                      {() =>
                        TOPIC_OPTIONS.find((t) => t.value === field.value)?.label ??
                        "Sin especificar"
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  {TOPIC_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {topic === "otro" && (
          <FormField
            control={form.control}
            name="topicOther"
            render={({ field }) => (
              <FormItem className="sm:max-w-sm">
                <FormLabel>Especificá el motivo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Fobia social" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Tratamiento del paciente (solo sesión individual, al crear). */}
        {kind === "individual" &&
          !editing &&
          (participantIds.length > 0 || lockedPatientId) && (
            <div className="space-y-3 sm:max-w-sm">
              <FormField
                control={form.control}
                name="treatmentMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tratamiento</FormLabel>
                    <Select
                      value={field.value ?? "active"}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {() => {
                              const v = field.value ?? "active";
                              if (v === "new") return "Nuevo tratamiento";
                              if (v === "none")
                                return "Sin tratamiento (consulta puntual)";
                              return activeProcess
                                ? `Tratamiento actual: ${activeProcess.label ?? "En curso"}`
                                : "Iniciar tratamiento";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">
                          {activeProcess
                            ? `Tratamiento actual: ${activeProcess.label ?? "En curso"}`
                            : "Iniciar tratamiento"}
                        </SelectItem>
                        <SelectItem value="new">Nuevo tratamiento</SelectItem>
                        <SelectItem value="none">
                          Sin tratamiento (consulta puntual)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {treatmentMode === "new" && (
                <>
                  {activeProcess && (
                    <p className="text-muted-foreground text-xs">
                      Se dará de alta el tratamiento actual y se abrirá uno nuevo.
                    </p>
                  )}
                  <FormField
                    control={form.control}
                    name="treatmentMotivoCategoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo del tratamiento</FormLabel>
                        <Select
                          value={field.value || NONE}
                          onValueChange={(v) =>
                            field.onChange(v === NONE ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Sin especificar">
                                {() =>
                                  MOTIVO_OPTIONS.find(
                                    (m) => m.value === field.value,
                                  )?.label ?? "Sin especificar"
                                }
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>Sin especificar</SelectItem>
                            {MOTIVO_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
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
                    name="treatmentMotivoConsulta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Detalle{" "}
                          <span className="text-muted-foreground font-normal">
                            · opcional
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Narrativa libre del motivo de consulta…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          )}

        {/* Recordatorio: solo tiene sentido si hay un paciente al cual avisar. */}
        {participantIds.length > 0 && (
          <FormField
            control={form.control}
            name="reminderOffsetMin"
            render={({ field }) => (
              <FormItem className="sm:max-w-xs">
                <FormLabel>Recordatorio al paciente (WhatsApp)</FormLabel>
                <Select
                  value={field.value == null ? NONE : String(field.value)}
                  onValueChange={(v) =>
                    field.onChange(v === NONE ? null : Number(v))
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin recordatorio">
                        {() => {
                          const v = field.value;
                          if (v == null) return "Sin recordatorio";
                          return (
                            REMINDER_OFFSET_OPTIONS.find((o) => o.value === v)
                              ?.label ?? `${v} min antes`
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin recordatorio</SelectItem>
                    {REMINDER_OFFSET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Aviso de cita por WhatsApp: solo si el psicólogo lo tiene habilitado
            y la sesión tiene al menos un paciente. */}
        {canNotify && participantIds.length > 0 && (
          <FormField
            control={form.control}
            name="notifyPatient"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between gap-4 sm:max-w-md">
                <div className="min-w-0">
                  <FormLabel>Avisar al paciente por WhatsApp</FormLabel>
                  <p className="text-muted-foreground text-xs">
                    Le llega un aviso al agendar, reprogramar o cancelar.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Estado: solo al editar. Una sesión nueva siempre nace "Programada";
            el estado se cambia después desde la agenda / la sesión. */}
        {editing && <StatusField form={form} />}

        {/* Las notas clínicas (observaciones/objetivos/próximos pasos) se cargan
            en el workspace de la sesión (al trabajarla/finalizarla), no acá. */}

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Guardar cambios" : "Guardar sesión"}
        </Button>
      </form>
    </Form>
  );
}

/** Fecha + hora + duración (compartido por sesión y bloque). */
function WhenFields({
  form,
}: {
  form: ReturnType<typeof useForm<SessionInput>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Fecha</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="time"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Hora</FormLabel>
            <FormControl>
              <Input type="time" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="durationMin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Duración</FormLabel>
            <Select
              value={String(field.value)}
              onValueChange={(v) => field.onChange(Number(v))}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => `${field.value} min`}</SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** Selector de estado (solo se muestra al editar). */
function StatusField({
  form,
}: {
  form: ReturnType<typeof useForm<SessionInput>>;
}) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => (
        <FormItem className="sm:max-w-xs">
          <FormLabel>Estado</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() =>
                    SESSION_STATUS_OPTIONS.find((s) => s.value === field.value)
                      ?.label ?? "Programada"
                  }
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {SESSION_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Alta rápida de paciente sin salir del popup de sesión. */
function QuickPatient({
  onCreated,
  onCancel,
}: {
  onCreated: (p: SchedulingPatient) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await quickCreatePatient({
        firstName,
        lastName,
        phone,
        whatsappOptIn: false,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res.patient) {
        toast.success("Paciente creado");
        onCreated(res.patient);
      }
    });
  }

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Nuevo paciente</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nombre"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
        <Input
          placeholder="Apellido"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
      </div>
      <Input
        placeholder="Teléfono (opcional, ej: +595981123456)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      />
      <div className="flex gap-2">
        <Button type="button" disabled={isPending} onClick={save}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear y seleccionar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
