"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Clock,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { deleteSession } from "@/server/actions";
import {
  topicLabel,
  statusLabel,
  statusBadgeVariant,
  CAL_LEGEND,
} from "@/lib/sessionLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { WeekGrid, startOfWeek, type CalSession } from "./WeekGrid";
import { MonthGrid } from "./MonthGrid";
import { BlockTimeDialog } from "./BlockTimeDialog";
import type { Availability } from "@/lib/availability";
import {
  SessionForm,
  type SessionEditData,
  type SchedulingPatient,
} from "@/components/features/sessions/SessionForm";

export interface SessionData {
  id: string;
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
  notifyPatient: boolean;
  groupId: string | null;
  participants: { id: string; fullName: string }[];
}

const DAY_MS = 86_400_000;
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function sessionLabel(s: SessionData): string {
  return s.participants.map((p) => p.fullName).join(", ") || s.title || "Bloque";
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function toEditData(s: SessionData): SessionEditData {
  return {
    id: s.id,
    participantIds: s.participants.map((p) => p.id),
    title: s.title,
    startsAt: s.startsAt,
    durationMin: s.durationMin,
    status: s.status,
    topic: s.topic,
    topicOther: s.topicOther,
    observations: s.observations,
    goals: s.goals,
    nextSteps: s.nextSteps,
    reminderOffsetMin: s.reminderOffsetMin,
    notifyPatient: s.notifyPatient,
    groupId: s.groupId,
  };
}

interface AgendaViewProps {
  sessions: SessionData[];
  patients: SchedulingPatient[];
  groups?: { id: string; name: string; memberIds: string[] }[];
  canNotify?: boolean;
  /** horario de atención para sombrear en la vista Semana */
  availability?: Availability | null;
}

type View = "calendar" | "list";
type CalMode = "day" | "week" | "month";
type ListTab = "today" | "upcoming" | "past";

export function AgendaView({
  sessions,
  patients,
  groups,
  canNotify,
  availability,
}: AgendaViewProps) {
  const [today] = useState(() => new Date());
  const [view, setView] = useState<View>("calendar");
  const [calMode, setCalMode] = useState<CalMode>("week");
  const [cursor, setCursor] = useState(() => today);
  const [listTab, setListTab] = useState<ListTab>("upcoming");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SessionData | null>(null);
  const [formDefault, setFormDefault] = useState<{ date: string; time?: string }>(
    () => ({ date: toYMD(today) }),
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const now = today.getTime();

  const calSessions: CalSession[] = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        durationMin: s.durationMin,
        status: s.status,
        label: sessionLabel(s),
        isBlock: s.participants.length === 0,
      })),
    [sessions],
  );

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const dayStart = useMemo(() => {
    const x = new Date(cursor);
    x.setHours(0, 0, 0, 0);
    return x;
  }, [cursor]);

  const list = useMemo(() => {
    const byTime = (a: SessionData, b: SessionData) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (listTab === "today") {
      return sessions
        .filter((s) => sameDay(new Date(s.startsAt), today))
        .sort(byTime);
    }
    if (listTab === "upcoming") {
      return sessions.filter((s) => new Date(s.startsAt).getTime() >= now).sort(byTime);
    }
    return sessions
      .filter((s) => new Date(s.startsAt).getTime() < now)
      .sort((a, b) => -byTime(a, b));
  }, [sessions, listTab, now, today]);

  function openNew(slot?: Date) {
    const d = slot ?? cursor;
    setFormDefault({
      date: toYMD(d),
      time: slot ? `${String(slot.getHours()).padStart(2, "0")}:00` : undefined,
    });
    setEditing(null);
    setShowForm(true);
  }
  function openSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    if (s) {
      setEditing(s);
      setShowForm(false);
    }
  }
  function remove(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteSession(id);
      setDeletingId(null);
      if (res?.error) toast.error(res.error);
      else toast.success("Sesión eliminada");
    });
  }

  function navigate(delta: number) {
    setCursor((c) =>
      calMode === "day"
        ? addDays(c, delta)
        : calMode === "week"
          ? addDays(c, delta * 7)
          : new Date(c.getFullYear(), c.getMonth() + delta, 1),
    );
  }

  // Título del calendario según el modo.
  const calTitle =
    calMode === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : calMode === "day"
        ? cursor.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : (() => {
          const end = addDays(weekStart, 6);
          const sameMonth = weekStart.getMonth() === end.getMonth();
          return sameMonth
            ? `${weekStart.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
            : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
        })();

  return (
    <div className="space-y-4">
      {/* Tabs Calendario / Lista + Nueva sesión */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { key: "calendar", label: "Calendario" },
            { key: "list", label: "Lista" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <BlockTimeDialog defaultDate={toYMD(cursor)} />
          <Button onClick={() => openNew()}>
            <Plus className="h-4 w-4" />
            Nueva sesión
          </Button>
        </div>
      </div>

      {view === "calendar" ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            {/* Barra del calendario: navegación + título + Semana/Mes */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigate(-1)}
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigate(1)}
                  aria-label="Siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCursor(today)}>
                  Hoy
                </Button>
                <h2 className="ml-1 text-lg font-medium capitalize">{calTitle}</h2>
              </div>
              <Segmented
                value={calMode}
                onChange={setCalMode}
                options={[
                  { key: "day", label: "Día" },
                  { key: "week", label: "Semana" },
                  { key: "month", label: "Mes" },
                ]}
              />
            </div>

            {/* Leyenda de colores por estado */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {CAL_LEGEND.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className={cn("h-3 w-3 rounded-full", s.dot)} />
                  {s.label}
                </span>
              ))}
            </div>

            {calMode === "month" ? (
              <MonthGrid
                month={cursor}
                sessions={calSessions}
                onNew={openNew}
                onOpen={openSession}
                onPickDay={(d) => {
                  setCursor(d);
                  setCalMode("day");
                }}
              />
            ) : (
              <WeekGrid
                weekStart={calMode === "day" ? dayStart : weekStart}
                dayCount={calMode === "day" ? 1 : 7}
                sessions={calSessions}
                availability={availability}
                onNew={openNew}
                onOpen={openSession}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <Segmented
              value={listTab}
              onChange={setListTab}
              options={[
                { key: "today", label: "Hoy" },
                { key: "upcoming", label: "Próximas" },
                { key: "past", label: "Pasadas" },
              ]}
            />
            {list.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {listTab === "today"
                  ? "Sin sesiones hoy."
                  : listTab === "upcoming"
                    ? "No hay sesiones próximas."
                    : "No hay sesiones pasadas."}
              </p>
            ) : (
              <ul className="space-y-2">
                {list.map((s) => {
                  const motivo = topicLabel(s.topic, s.topicOther);
                  return (
                    <li
                      key={s.id}
                      className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <Clock className="text-muted-foreground h-4 w-4" />
                          {fmtDateTime(s.startsAt)} · {s.durationMin}′
                        </p>
                        <p className="text-muted-foreground flex items-center gap-2 text-sm">
                          <UserIcon className="h-3.5 w-3.5" />
                          {sessionLabel(s)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant={statusBadgeVariant(s.status)}>
                            {statusLabel(s.status)}
                          </Badge>
                          {motivo && <Badge variant="outline">{motivo}</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(s)}
                          aria-label="Editar sesión"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(s.id)}
                          disabled={isPending && deletingId === s.id}
                          aria-label="Eliminar sesión"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Crear / editar sesión en modal (unificado). */}
      <Dialog
        open={showForm || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? editing.participants.length === 0
                  ? "Bloqueo de horario"
                  : "Editar sesión"
                : "Nueva sesión"}
            </DialogTitle>
          </DialogHeader>
          <SessionForm
            patients={patients}
            defaultDate={editing ? undefined : formDefault.date}
            defaultTime={editing ? undefined : formDefault.time}
            groups={groups}
            session={editing ? toEditData(editing) : undefined}
            canNotify={canNotify}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
